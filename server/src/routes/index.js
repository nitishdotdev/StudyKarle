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
// Each "/"-mounted router scopes its own `authenticate` and
// `authenticatedActionLimiter` middleware to its path prefix(es) so auth and
// rate limiting execute once per request and never intercept sibling routers
// or public share endpoints (/drive/shares/:token).
router.use('/', driveRoutes);
router.use('/', paymentRoutes);
router.use('/', yearRoutes);
router.use('/', noteRoutes);
router.use('/saved', savedRoutes);
router.use('/search', searchRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
