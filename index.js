// index.js
require('dotenv').config()
const { Telegraf, Markup } = require('telegraf')
const sqlite3 = require('sqlite3').verbose()
const axios = require('axios')

// إعداد البوت
const bot = new Telegraf(process.env.BOT_TOKEN)

// إعداد قاعدة البيانات SQLite
const db = new sqlite3.Database('./database/bot.db', (err) => {
  if(err) console.error(err)
  else console.log('Connected to SQLite DB')
})

// إنشاء جدول المستخدمين إذا لم يكن موجودًا
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegramId TEXT UNIQUE,
  usd REAL DEFAULT 0,
  points INTEGER DEFAULT 0,
  withdrawWallet TEXT
)`)

// --- دوال مساعدة ---
const ensureUser = (telegramId) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE telegramId = ?`, [telegramId], (err, row) => {
      if(err) return reject(err)
      if(!row){
        db.run(`INSERT INTO users(telegramId) VALUES(?)`, [telegramId], function(err){
          if(err) return reject(err)
          db.get(`SELECT * FROM users WHERE telegramId = ?`, [telegramId], (err2, newRow) => resolve(newRow))
        })
      } else resolve(row)
    })
  })
}

const updateUserBalance = (telegramId, usdDelta, pointsDelta=0) => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE users SET usd = usd + ?, points = points + ? WHERE telegramId = ?`,
      [usdDelta, pointsDelta, telegramId],
      function(err){ if(err) reject(err); else resolve() })
  })
}

// --- قائمة رئيسية ---
const mainMenu = () => Markup.inlineKeyboard([
  [Markup.button.callback('💰 مشاهدة إعلان', 'AD_VIEW')],
  [Markup.button.callback('🏃 استثمار لعبة القفز', 'GAME_INVEST')],
  [Markup.button.callback('💸 سحب الأرباح', 'WITHDRAW')]
])

// --- مشاهدة الإعلان ---
bot.action('AD_VIEW', async (ctx) => {
  const user = await ensureUser(String(ctx.from.id))
  await ctx.answerCbQuery()
  const adLink = process.env.AD_LINK || 'ضع رابط الإعلان هنا'
  await ctx.reply(`اضغط على الرابط لمشاهدة الإعلان:\n${adLink}\n\nبعد الانتهاء اضغط ✅ تم المشاهدة.`)
  await ctx.reply('تم؟', Markup.inlineKeyboard([
    [Markup.button.callback('✅ تم المشاهدة', 'AD_DONE')]
  ]))
})

bot.action('AD_DONE', async (ctx) => {
  const tgId = String(ctx.from.id)
  const reward = 0.02 // دولار لكل إعلان
  await updateUserBalance(tgId, reward)
  await ctx.answerCbQuery('أُضيفت المكافأة إلى محفظتك ✅')
  await ctx.reply(`+${reward.toFixed(2)}$ أُضيفت إلى محفظتك.`, mainMenu())
})

// --- استثمار لعبة القفز ---
bot.action('GAME_INVEST', async (ctx) => {
  const tgId = String(ctx.from.id)
  const user = await ensureUser(tgId)

  // مثال استثمار: كل قفزة = 2 نقطة، 200 نقطة = 5$
  const jumps = 100 // عدد القفزات (يمكن جعله ديناميكي)
  const pointsPerJump = 2
  const usdPer200Points = 5

  const earnedPoints = jumps * pointsPerJump
  const earnedUsd = Math.floor(earnedPoints / 200) * usdPer200Points

  await updateUserBalance(tgId, earnedUsd, earnedPoints)
  await ctx.reply(`استثمرت ${jumps} قفزة → ${earnedPoints} نقطة → +${earnedUsd}$ إلى محفظتك.`, mainMenu())
})

// --- السحب إلى USDT TRC20 ---
bot.action('WITHDRAW', async (ctx) => {
  const tgId = String(ctx.from.id)
  const user = await ensureUser(tgId)
  const minWithdraw = parseFloat(process.env.MIN_WITHDRAW) || 20

  if(user.usd < minWithdraw){
    return ctx.reply(`رصيدك الحالي ${user.usd.toFixed(2)}$. الحد الأدنى للسحب هو ${minWithdraw}$`)
  }

  const amount = user.usd
  const wallet = user.withdrawWallet || process.env.TRC20_WALLET

  try{
    // طلب السحب عبر NOWPayments
    const response = await axios.post('https://api.nowpayments.io/v1/invoice', {
      price_amount: amount,
      price_currency: 'usd',
      pay_currency: 'usdt_trc20',
      payout_address: wallet
    }, { headers: { 'x-api-key': process.env.NOWPAYMENTS_API_KEY } })

    // إعادة تعيين الرصيد الداخلي
    db.run(`UPDATE users SET usd = 0 WHERE telegramId = ?`, [tgId])

    await ctx.reply(`تم إنشاء طلب السحب ✅\nالمبلغ: ${amount}$\nعنوان المحفظة: ${wallet}`)
  } catch(e){
    console.error(e)
    await ctx.reply('حدث خطأ أثناء محاولة السحب. حاول لاحقًا.')
  }
})

// --- بدء البوت ---
bot.start(async (ctx) => {
  const user = await ensureUser(String(ctx.from.id))
  await ctx.reply(`مرحبًا ${ctx.from.first_name} 👋\nاختر من القائمة:`, mainMenu())
})

// --- أي رسالة غير معروفة ---
bot.on('message', (ctx) => ctx.reply('اضغط على الأزرار أدناه لاختيار المهمة:', mainMenu()))

// --- تشغيل البوت ---
bot.launch()
console.log('Bot is running...')
