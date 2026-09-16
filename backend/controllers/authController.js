'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const VerificationCode = require('../models/VerificationCode');
const Driver = require('../models/Driver');

const config = require('../config/env');

const asyncHandler =
  require('../utils/asyncHandler');

const {
  normalizePhone
} = require('../utils/modelHelpers');

const VERIFICATION_TTL_MS =
  5 * 60 * 1000;

const MAX_VERIFICATION_ATTEMPTS =
  5;

const createToken = (user) =>
  jwt.sign(
    {
      id: String(user._id),
      role: user.role
    },
    config.JWT_SECRET,
    {
      expiresIn:
        config.JWT_EXPIRES_IN
    }
  );

const generateCode = () =>
  crypto
    .randomInt(
      100000,
      1000000
    )
    .toString();

const sanitizeUser = (user) => {
  const value =
    user?.toObject
      ? user.toObject()
      : { ...user };

  delete value.password;
  delete value.__v;

  return value;
};

/* =========================================================
   REQUEST TELEGRAM VERIFICATION
========================================================= */

exports.requestTelegramVerification = asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body.phone);

   const existingUser = await User.findOne({ phone }).lean();

      if (existingUser) {
        if (existingUser.approvalStatus === 'pending') {
          await User.deleteOne({ phone });
        } else {
          return res.status(409).json({
            success: false,
            message: 'An account already exists for this phone number.'
          });
        }
      }

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 12);
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    await VerificationCode.findOneAndUpdate(
        { phone, purpose: 'registration' },
        {
            $set: {
                codeHash,
                verified: false,
                verifiedAt: null,
                attempts: 0,
                expiresAt
                // FIX: Removed telegramChatId: '' to prevent E11000 duplicate key crashes
            }
        },
        {
            returnDocument: 'after',
            upsert: true,
            runValidators: true
        }
    );

    const botUsername = String(process.env.TELEGRAM_BOT_USERNAME || '')
        .replace(/^@/, '')
        .trim();

    const telegramBotLink = botUsername
        ? `https://t.me/${botUsername}?start=${code}`
        : null;

    return res.status(200).json({
        success: true,
        message: 'Verification request created. Complete verification through Telegram.',
        telegramBotLink,
        expiresInSeconds: VERIFICATION_TTL_MS / 1000,
        verificationCode: code
    });
});
/* =========================================================
   CHECK TELEGRAM VERIFICATION
========================================================= */

exports.checkTelegramVerification =
  asyncHandler(
    async (req, res) => {
      const phone =
        normalizePhone(
          req.body.phone
        );

      const record =
        await VerificationCode
          .findOne({
            phone,
            purpose:
              'registration'
          })
          .select('+codeHash');

      if (!record) {
        return res.status(404).json({
          success: false,
          verified: false,
          message:
            'Verification request was not found.'
        });
      }

      if (
        record.expiresAt <=
        new Date()
      ) {
        return res.status(410).json({
          success: false,
          verified: false,
          message:
            'Verification request has expired.'
        });
      }


      if (!record.verified) {
        return res.status(200).json({
          success: true,
          verified: false,
          message:
            'Telegram verification has not been completed yet.'
        });
      }

      return res.status(200).json({
        success: true,
        verified: true,
        telegramChatId:
          record.telegramChatId ||
          null
      });
    }
  );

/* =========================================================
   REGISTER
========================================================= */

exports.register =
  asyncHandler(
    async (req, res) => {
      const {
        name,
        email,
        phone,
        password,
        role = 'passenger',
        targaNo
      } = req.body;

      const normalizedPhone =
        normalizePhone(phone);

      const normalizedEmail =
        email?.trim()
          ? String(email)
            .trim()
            .toLowerCase()
          : undefined;



      const verification =
        await VerificationCode
          .findOne({
            phone:
              normalizedPhone,

            purpose:
              'registration',

            verified: true,

            expiresAt: {
              $gt:
                new Date()
            }
          });

      if (!verification) {
        return res.status(403).json({
          success: false,
          message:
            'Telegram verification must be completed before registration.'
        });
      }

     const duplicateQuery = { $or: [{ phone: normalizedPhone }] };
  if (normalizedEmail) duplicateQuery.$or.push({ email: normalizedEmail });

 
  const existingUser = await User.findOne(duplicateQuery);
      
      if (existingUser) {
        if (existingUser.approvalStatus === 'pending') {
          await User.deleteOne({ _id: existingUser._id });
        } else {
          return res.status(409).json({
            success: false,
            message: 'An account with these details already exists.'
          });
        }
      }

      const user =
        await User.create({
          name:
            String(name).trim(),

          phone:
            normalizedPhone,

          email:
            normalizedEmail,

          password,

          role:
            role === 'driver'
              ? 'driver'
              : 'passenger',

          telegramChatId:
            verification.telegramChatId ||
            '',

          verificationStatus: 'verified',

          approvalStatus:
            role === 'driver'
              ? 'pending'
              : 'approved'
        });

      if (role === 'driver' && targaNo) {
    await Driver.create({
      user: user._id,
      targaNo: targaNo.trim(),
      driverId: 'DRV-' + crypto.randomInt(1000, 9999) // <-- ADD THIS LINE
    });
  }

      /*
       * Verification is single-use.
       */
      await VerificationCode
        .deleteOne({
          _id:
            verification._id
        });

      // Send "Under Review" Telegram Notification
      const { bot } = require('../config/telegram');
      if (bot && user.telegramChatId) {
        const reviewMsg = `🎉 *Registration Successful!*\n\nHello ${user.name}, your TaxiPay account has been created and is currently **under review** by our team.\n\nPlease wait for an approval message before attempting to log in.`;
        
        bot.sendMessage(user.telegramChatId, reviewMsg, { parse_mode: 'Markdown' })
           .catch(err => console.error('Telegram notification failed:', err));
      }

      return res.status(201).json({
        success: true,
        message: 'Registration successful. Account under review.',
        user: sanitizeUser(user)
      });
    }
  );

/* =========================================================
   LOGIN
========================================================= */

exports.login =
  asyncHandler(
    async (req, res) => {
      const phone =
        normalizePhone(
          req.body.phone
        );

      const password =
        String(
          req.body.password ||
          ''
        );

      const user =
        await User
          .findOne({
            phone
          })
          .select('+password');

      /*
       * Use identical response for
       * missing user and wrong password.
       */
      if (!user) {
        return res.status(401).json({
          success: false,
          message:
            'Invalid phone number or password.'
        });
      }

      if (user.isBlocked) {
        return res.status(403).json({
          success: false,
          message:
            'This account is blocked.'
        });
      }

      const passwordMatches =
        await user.matchPassword(
          password
        );

      if (!passwordMatches) {
        return res.status(401).json({
          success: false,
          message:
            'Invalid phone number or password.'
        });
      }

      if (user.approvalStatus === 'rejected') {
        return res.status(403).json({
          success: false,
          message:
            'Your account has been rejected.'
        });
      }

      if (
        user.role === 'driver' &&
        user.approvalStatus !==
        'approved'
      ) {
        return res.status(403).json({
          success: false,
          message:
            'Driver account is awaiting approval.'
        });
      }

      return res.status(200).json({
        success: true,

        token:
          createToken(user),

        user:
          sanitizeUser(user)
      });
    }
  );

/* =========================================================
   CURRENT USER
========================================================= */

exports.getMe =
  asyncHandler(
    async (req, res) => {
      return res.status(200).json({
        success: true,

        user:
          sanitizeUser(
            req.user
          )
      });
    }
  );

/* =========================================================
   LOGOUT
========================================================= */

exports.logout =
  asyncHandler(
    async (req, res) => {
      /*
       * JWT logout is client-side unless
       * you implement token blacklisting.
       */

      return res.status(200).json({
        success: true,
        message:
          'Logged out successfully.'
      });
    }
  );

/* =========================================================
   TELEGRAM WEBHOOK
========================================================= */

exports.telegramWebhook =
  asyncHandler(
    async (req, res) => {
      const message =
        req.body?.message;

      if (
        !message?.chat?.id ||
        !message?.text
      ) {
        return res.status(200).json({
          success: true
        });
      }

      const telegramChatId =
        String(
          message.chat.id
        );

      const text =
        String(
          message.text
        ).trim();

      /*
       * Expected:
       *
       * /start 123456
       */
      if (
        !text.startsWith(
          '/start'
        )
      ) {
        return res.status(200).json({
          success: true
        });
      }

      const parts =
        text.split(/\s+/);

      const code =
        parts.length > 1
          ? parts[1].trim()
          : '';

      if (
        !/^\d{6}$/.test(code)
      ) {
        return res.status(200).json({
          success: true
        });
      }

      const records =
        await VerificationCode
          .find({
            purpose:
              'registration',

            verified: false,

            expiresAt: {
              $gt:
                new Date()
            },

            attempts: {
              $lt:
                MAX_VERIFICATION_ATTEMPTS
            }
          })
          .select('+codeHash');

      let verifiedRecord =
        null;

      /*
       * Compare against hashed codes.
       */
      for (
        const record of records
      ) {
        const matches =
          await bcrypt.compare(
            code,
            record.codeHash
          );

        if (matches) {
          verifiedRecord =
            record;

          break;
        }
      }

      if (!verifiedRecord) {
        return res.status(200).json({
          success: true
        });
      }

      /*
       * Atomic update prevents duplicate
       * Telegram webhook processing.
       */
      const updated =
        await VerificationCode
          .findOneAndUpdate(
            {
              _id:
                verifiedRecord._id,

              verified: false,

              expiresAt: {
                $gt:
                  new Date()
              }
            },

            {
              $set: {
                verified: true,

                verifiedAt:
                  new Date(),

                telegramChatId
              }
            },

            {
              returnDocument: 'after'
            }
          );

      if (!updated) {
        return res.status(200).json({
          success: true
        });
      }

      return res.status(200).json({
        success: true
      });
    }
  );
