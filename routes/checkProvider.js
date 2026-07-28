require('dotenv').config();
const mongoose = require('mongoose');
const ApiProvider = require('./models/ApiProvider');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const providers = await ApiProvider.find();

    console.log("===== PROVIDERS =====");
    providers.forEach((p) => {
      console.log({
        id: p._id.toString(),
        name: p.name,
        apiUrl: p.apiUrl,
        apiKey: p.apiKey,
      });
    });

    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();