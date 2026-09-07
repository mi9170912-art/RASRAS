const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json({ limit: '5mb' }));

app.use(express.static(path.join(__dirname, 'public')));

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return {
      orders: [],
      customers: [],
      suppliers: []
    };
  }
}

function writeData(data) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2),
    'utf8'
  );
}

// Get all system data
app.get('/api/data', (req, res) => {
  res.json(readData());
});

// Save all system data
app.post('/api/data', (req, res) => {
  try {
    writeData(req.body);

    res.json({
      ok: true
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      ok: false,
      error: 'تعذر الحفظ'
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    system: 'Order Flow System'
  });
});

// Export the Express app
module.exports = app;
