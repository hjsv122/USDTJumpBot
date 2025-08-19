require("dotenv").config();
const express = require("express");
const TronWeb = require("tronweb");
const fs = require("fs");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const tronWeb = new TronWeb({
  fullHost: "https://api.trongrid.io",
  privateKey: process.env.PRIVATE_KEY,
});

const pendingFile = "./pending.json";

// ✅ إرسال TRX
async function sendTRX(to, amount) {
  const balance = await tronWeb.trx.getBalance(tronWeb.defaultAddress.base58);
  if (balance < amount + 1000000) throw new Error("🚫 لا يوجد رصيد كافٍ.");

  const tx = await tronWeb.trx.sendTransaction(to, amount);
  return tx;
}

// ✅ حفظ في قائمة الانتظار
function savePending(address, amount) {
  const pending = fs.existsSync(pendingFile)
    ? JSON.parse(fs.readFileSync(pendingFile))
    : [];

  pending.push({ address, amount });
  fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2));
}

// ✅ نقطة استقبال طلب السحب
app.post("/withdraw", async (req, res) => {
  const { address, amount } = req.body;

  if (!tronWeb.isAddress(address)) {
    return res.status(400).json({ message: "❌ عنوان TRX غير صالح." });
  }

  const amountInSun = Math.floor(Number(amount) * 1_000_000);

  try {
    const tx = await sendTRX(address, amountInSun);
    res.json({ message: "✅ تم الإرسال بنجاح!", tx });
  } catch (err) {
    savePending(address, amountInSun);
    res.json({
      message:
        "⚠️ لا يوجد رصيد كافٍ حاليًا. تم حفظ طلبك وسيتم تنفيذه لاحقًا.",
    });
  }
});

// ✅ نقطة فحص الرصيد
app.get("/balance", async (req, res) => {
  const balance = await tronWeb.trx.getBalance(tronWeb.defaultAddress.base58);
  res.json({ balance: balance / 1_000_000 });
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
