const express = require('express');

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const yearRoutes = require('./yearRoutes');
const noteRoutes = require('./noteRoutes');
const driveRoutes = require('./driveRoutes');
const savedRoutes = require('./savedRoutes');
const searchRoutes = require('./searchRoutes');
const adminRoutes = require('./adminRoutes');
const paymentRoutes = require('./paymentRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
// driveRoutes is mounted before the other "/"-mounted routers because it owns
// public, token-gated share endpoints (/drive/shares/:token) that must not be
// intercepted by the global `authenticate` middleware in the note/year/search
// routers (which are path-agnostic inside their own mount).
router.use('/', driveRoutes);
router.use('/', paymentRoutes);
router.use('/', yearRoutes);
router.use('/', noteRoutes);
router.use('/saved', savedRoutes);
router.use('/search', searchRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
