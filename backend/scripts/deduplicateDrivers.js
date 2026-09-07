'use strict';

/**
 * One-time script to find and remove duplicate User and Driver documents.
 *
 * Usage:
 *   node scripts/deduplicateDrivers.js
 *
 * What it does:
 *   1. Finds User documents with duplicate phone numbers (keeps the latest).
 *   2. Finds Driver documents with duplicate `user` references (keeps the latest).
 *   3. Logs everything it finds before deleting.
 *   4. Removes orphan Driver docs whose `user` no longer exists.
 *
 * Run this ONCE after identifying duplicates. Safe to re-run (idempotent).
 */

const mongoose = require('mongoose');
const path = require('path');

// Load config
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const config = require('../config/env');

const User = require('../models/User');
const Driver = require('../models/Driver');

const run = async () => {
  console.log('🔍 Connecting to database...');
  await mongoose.connect(config.MONGO_URI);
  console.log('✅ Connected.\n');

  // ─── Step 1: Find duplicate Users by phone ──────────────────────────
  console.log('═══════════════════════════════════════════');
  console.log('  Step 1: Checking for duplicate Users (by phone)');
  console.log('═══════════════════════════════════════════');

  const phoneDuplicates = await User.aggregate([
    { $group: { _id: '$phone', count: { $sum: 1 }, docs: { $push: { id: '$_id', name: '$name', role: '$role', createdAt: '$createdAt', updatedAt: '$updatedAt' } } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  let usersRemoved = 0;

  if (phoneDuplicates.length === 0) {
    console.log('  ✅ No duplicate Users found.\n');
  } else {
    for (const dup of phoneDuplicates) {
      console.log(`\n  📱 Phone: ${dup._id} — ${dup.count} duplicates`);

      // Sort by updatedAt descending, keep the newest
      const sorted = dup.docs.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      const keep = sorted[0];
      const remove = sorted.slice(1);

      console.log(`    ✅ KEEP:   ${keep.id} (${keep.name}, role: ${keep.role}, updated: ${keep.updatedAt || keep.createdAt})`);

      for (const r of remove) {
        console.log(`    ❌ REMOVE: ${r.id} (${r.name}, role: ${r.role}, updated: ${r.updatedAt || r.createdAt})`);

        // Before deleting, reassign any Driver docs pointing to this user
        const driversUsingOldUser = await Driver.find({ user: r.id });
        for (const drv of driversUsingOldUser) {
          console.log(`       → Reassigning Driver ${drv._id} from User ${r.id} to ${keep.id}`);
          const existingDriver = await Driver.findOne({ user: keep.id });
          if (existingDriver) {
            console.log(`       → Kept user already has Driver ${existingDriver._id}, removing duplicate Driver ${drv._id}`);
            await Driver.deleteOne({ _id: drv._id });
          } else {
            await Driver.updateOne({ _id: drv._id }, { $set: { user: keep.id } });
          }
        }

        // Reassign transactions
        const Transaction = require('../models/Transaction');
        await Transaction.updateMany({ user: r.id }, { $set: { user: keep.id } });
        await Transaction.updateMany({ driver: r.id }, { $set: { driver: keep.id } });

        await User.deleteOne({ _id: r.id });
        usersRemoved++;
      }
    }
    console.log(`\n  📊 Removed ${usersRemoved} duplicate User(s).\n`);
  }

  // ─── Step 2: Find duplicate Drivers by user ref ─────────────────────
  console.log('═══════════════════════════════════════════');
  console.log('  Step 2: Checking for duplicate Drivers (by user ref)');
  console.log('═══════════════════════════════════════════');

  const driverDuplicates = await Driver.aggregate([
    { $group: { _id: '$user', count: { $sum: 1 }, docs: { $push: { id: '$_id', targaNo: '$targaNo', driverId: '$driverId', createdAt: '$createdAt', updatedAt: '$updatedAt', isProfileCompleted: '$isProfileCompleted' } } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  let driversRemoved = 0;

  if (driverDuplicates.length === 0) {
    console.log('  ✅ No duplicate Drivers found.\n');
  } else {
    for (const dup of driverDuplicates) {
      console.log(`\n  👤 User ref: ${dup._id} — ${dup.count} duplicates`);

      const sorted = dup.docs.sort((a, b) => {
        if (a.isProfileCompleted && !b.isProfileCompleted) return -1;
        if (!a.isProfileCompleted && b.isProfileCompleted) return 1;
        return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      });

      const keep = sorted[0];
      const remove = sorted.slice(1);

      console.log(`    ✅ KEEP:   ${keep.id} (targa: ${keep.targaNo}, driverId: ${keep.driverId}, profile: ${keep.isProfileCompleted})`);

      for (const r of remove) {
        console.log(`    ❌ REMOVE: ${r.id} (targa: ${r.targaNo}, driverId: ${r.driverId}, profile: ${r.isProfileCompleted})`);
        await Driver.deleteOne({ _id: r.id });
        driversRemoved++;
      }
    }
    console.log(`\n  📊 Removed ${driversRemoved} duplicate Driver(s).\n`);
  }

  // ─── Step 3: Find orphan Drivers ────────────────────────────────────
  console.log('═══════════════════════════════════════════');
  console.log('  Step 3: Checking for orphan Drivers (no matching User)');
  console.log('═══════════════════════════════════════════');

  const allDrivers = await Driver.find().select('user targaNo driverId').lean();
  let orphansRemoved = 0;

  for (const drv of allDrivers) {
    const userExists = await User.exists({ _id: drv.user });
    if (!userExists) {
      console.log(`  ❌ Orphan Driver: ${drv._id} (targa: ${drv.targaNo}, user: ${drv.user}) — removing`);
      await Driver.deleteOne({ _id: drv._id });
      orphansRemoved++;
    }
  }

  if (orphansRemoved === 0) {
    console.log('  ✅ No orphan Drivers found.\n');
  } else {
    console.log(`\n  📊 Removed ${orphansRemoved} orphan Driver(s).\n`);
  }

  // ─── Summary ────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════');
  console.log(`  Users removed:   ${usersRemoved}`);
  console.log(`  Drivers removed: ${driversRemoved}`);
  console.log(`  Orphans removed: ${orphansRemoved}`);
  console.log(`  Total cleaned:   ${usersRemoved + driversRemoved + orphansRemoved}`);
  console.log('═══════════════════════════════════════════\n');

  await mongoose.disconnect();
  console.log('✅ Database disconnected. Done.');
};

run().catch((err) => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
