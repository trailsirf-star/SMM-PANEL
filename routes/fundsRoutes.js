const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const fundsController = require('../controllers/fundsController');
const upload = require('../middleware/upload');

router.use(protect);
router.get('/add', fundsController.getAddFunds);
router.post('/add', upload.single('screenshot'), fundsController.postAddFunds);

module.exports = router;