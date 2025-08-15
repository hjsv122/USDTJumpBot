require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// إعداد قاعدة البيانات في مجلد مسموح بالكتابة (tmp)
const dbPath = path.resolve(__dirname, 'tmp/database.sqlite');
const fs = require('fs');
if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}
const db = new sqlite3.Database(dbPath);

// إنشاء جدول المستخدمين إذا لم يكن موجودًا
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  points INTEGER DEFAULT 0,
  balance REAL DEFAULT 0
)`);

// متغيرات البيئة
const BOT_TOKEN = process.env.BOT_TOKEN;
const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;
const NOWPAYMENTS_API_SECRET = process.env.NOWPAYMENTS_API_SECRET;
const TRC20_WALLET = process.env.TRC20_WALLET;
const MIN_WITHDRAW = parseFloat(process.env.MIN_WITHDRAW || '20');
const AD_LINK = process.env.AD_LINK;

// تشغيل البوت كـ Background Worker
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// رسالة ترحيب
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `مرحبًا! 🌟
اختر القسم:
1️⃣ مشاهدة إعلان
2️⃣ استثمار لعبة القفز
3️⃣ سحب الأرباح
`);
});

// مثال إضافة نقاط عند مشاهدة الإعلان
bot.onText(/مشاهدة إعلان/, (msg) => {
    const chatId = msg.chat.id;
    const pointsEarned = 2; // مثال: 1 إعلان = 2 نقطة

    db.run(`INSERT INTO users (id, points) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET points = points + ?`, [chatId, pointsEarned, pointsEarned], (err) => {
        if (err) return bot.sendMessage(chatId, 'حدث خطأ.');
        bot.sendMessage(chatId, `تمت إضافة ${pointsEarned} نقطة! 🌟`);
    });
});

// مثال تحويل نقاط إلى أرباح عند الاستثمار
bot.onText(/استثمار لعبة القفز/, (msg) => {
    const chatId = msg.chat.id;
    const pointsPerDollar = 40; // 200 نقطة = 5 دولار
    db.get(`SELECT points, balance FROM users WHERE id = ?`, [chatId], (err, row) => {
        if (err) return bot.sendMessage(chatId, 'حدث خطأ.');
        if (!row || row.points < 2) return bot.sendMessage(chatId, 'ليس لديك نقاط كافية للاستثمار.');
        const newBalance = row.balance + (row.points / pointsPerDollar);
        db.run(`UPDATE users SET balance = 0, points = 0, balance = ? WHERE id = ?`, [newBalance, chatId], () => {
            bot.sendMessage(chatId, `تم تحويل نقاطك إلى رصيد بقيمة $${newBalance.toFixed(2)} 💰`);
        });
    });
});

// مثال سحب الأرباح
bot.onText(/سحب الأرباح/, (msg) => {
    const chatId = msg.chat.id;
    db.get(`SELECT balance FROM users WHERE id = ?`, [chatId], (err, row) => {
        if (err) return bot.sendMessage(chatId, 'حدث خطأ.');
        if (!row || row.balance < MIN_WITHDRAW) return bot.sendMessage(chatId, `رصيدك أقل من الحد الأدنى للسحب $${MIN_WITHDRAW}.`);
        
        // هنا يمكنك إضافة كود السحب عبر NOWPayments API
        bot.sendMessage(chatId, `تم سحب $${row.balance.toFixed(2)} إلى محفظتك TRC20! 🚀`);
        
        // إعادة ضبط الرصيد بعد السحب
        db.run(`UPDATE users SET balance = 0 WHERE id = ?`, [chatId]);
    });
});

// تشغيل البوت
console.log('Bot is running as Background Worker...');
