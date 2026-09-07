const TelegramBotPackage = require('node-telegram-bot-api');
// Ensures compatibility whether imported as CommonJS default or named module
const TelegramBot = TelegramBotPackage.default || TelegramBotPackage;
const VerificationCode = require('../models/VerificationCode');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;
const USE_WEBHOOK = Boolean(TELEGRAM_WEBHOOK_URL);
// Robust Phone Normalizer (Handles +251..., 251..., 09... -> 9...)
const normalizePhone = (phone = '') => {
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('251')) cleaned = cleaned.slice(3);
  if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
  return cleaned;
};

let bot = null;

if (TELEGRAM_TOKEN) {
  bot = new TelegramBot(TELEGRAM_TOKEN, { polling: !USE_WEBHOOK });

  if (USE_WEBHOOK) {
    const webhookUrl = `${TELEGRAM_WEBHOOK_URL.replace(/\/$/, '')}/api/auth/telegram-webhook`;
    bot.setWebHook(webhookUrl).catch((err) => {
      console.error('Failed to set Telegram webhook:', err.message);
    });
  }

  // Handle /start <code> or /verify <code> (Case Insensitive)
  bot.onText(/\/(start|verify)\s*(\d{6})?/i, async (msg, match) => {
    const chatId = String(msg.chat.id);
    const code = match?.[2]?.trim();

    console.log('🔵 [Telegram Bot] Command from chat:', chatId, 'Code:', code || 'None');

    if (!code) {
      return bot.sendMessage(
        chatId,
        '👋 Welcome to TaxiPay!\n\nTo verify your registration, start verification inside the TaxiPay app and use the link provided or send `/verify <code>`.',
        { parse_mode: 'Markdown' }
      );
    }

    try {
      const pending = await VerificationCode.findOne({ code, verified: false });
      if (!pending) {
        console.error('❌ [Telegram Bot] Code not found or expired:', code);
        return bot.sendMessage(chatId, '❌ Code not found or expired. Please start verification again from TaxiPay.');
      }

      console.log('✅ [Telegram Bot] Code matched. Storing chatId:', chatId, 'Phone:', pending.phone);
      pending.telegramChatId = chatId;
      await pending.save();

      await bot.sendMessage(
        chatId,
        '✅ Verification code accepted!\n\nPlease click the button below to share your contact number so we can confirm ownership:',
        {
          reply_markup: {
            keyboard: [[{ text: '📱 Share My Phone Number', request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        }
      );
    } catch (err) {
      console.error('❌ Telegram verification handler error:', err.message);
      await bot.sendMessage(chatId, 'An error occurred while checking your code. Please try again shortly.');
    }
  });

  // Handle incoming shared contact card
  bot.on('contact', async (msg) => {
    const chatId = String(msg.chat.id);
    const rawPhone = msg.contact?.phone_number || '';
    const contactPhone = normalizePhone(rawPhone);

    console.log('🔵 [Telegram Bot] Contact received from:', chatId, 'Phone:', rawPhone, '-> Normalized:', contactPhone);

    if (!contactPhone) {
      console.error('❌ [Telegram Bot] Could not normalize shared phone number');
      return bot.sendMessage(chatId, 'Unable to read your shared phone number. Please share it again.');
    }

    try {
      const pending = await VerificationCode.findOne({ telegramChatId: chatId, verified: false }).sort({ createdAt: -1 });
      if (!pending) {
        console.error('❌ [Telegram Bot] No pending verification for chatId:', chatId);
        return bot.sendMessage(chatId, '❌ No pending verification found. Please restart verification from TaxiPay.');
      }

      const storedPhone = normalizePhone(pending.phone);
      console.log('🔵 [Telegram Bot] Comparing phones - Stored:', storedPhone, 'Shared:', contactPhone);

      if (storedPhone !== contactPhone) {
        console.error('❌ [Telegram Bot] Phone mismatch:', storedPhone, 'vs', contactPhone);
        return bot.sendMessage(
          chatId,
          '❌ The shared phone number does not match the phone number entered in TaxiPay.',
          { reply_markup: { remove_keyboard: true } }
        );
      }

      console.log('✅ [Telegram Bot] Phone numbers match! Verification successful.');
      pending.verified = true;
      pending.telegramChatId = chatId;
      await pending.save();

      await bot.sendMessage(
        chatId,
        '🎉 Telegram verification complete!\n\nYou can now return to the TaxiPay app and finish your setup.',
        { reply_markup: { remove_keyboard: true } }
      );
    } catch (err) {
      console.error('❌ Telegram contact handler error:', err.message);
      await bot.sendMessage(chatId, 'An error occurred while finalizing verification. Please try again.');
    }
  });
}

// Webhook Controller Route Handler
const handleTelegramWebhook = (req, res) => {
  if (bot && USE_WEBHOOK) {
    bot.processUpdate(req.body);
  }
  res.sendStatus(200);
};

module.exports = { bot, handleTelegramWebhook };