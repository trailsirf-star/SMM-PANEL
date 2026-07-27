const express = require('express');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const fundsController = require('../controllers/fundsController');

const router = express.Router();

router.get('/', protect, fundsController.getAddFundsPage);
router.post('/', protect, upload.single('screenshot'), fundsController.postAddFunds);

module.exports = router;
