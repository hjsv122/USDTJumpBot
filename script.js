let earnings = 0;
let mining = false;
let interval;
let duration = 60 * 60; // 1 ساعة = 3600 ثانية
let elapsed = 0;

const ball = document.getElementById("ball");
const statusText = document.getElementById("status");
const earningsText = document.getElementById("earnings");
const startBtn = document.getElementById("startBtn");
const withdrawBtn = document.getElementById("withdrawBtn");

function startMining() {
  if (mining) return;

  mining = true;
  elapsed = 0;
  statusText.textContent = "🏃‍♂️ التعدين جارٍ لمدة ساعة...";

  interval = setInterval(() => {
    if (elapsed >= duration) {
      clearInterval(interval);
      mining = false;
      statusText.textContent = "✅ انتهى التعدين! يمكنك الآن السحب.";
      return;
    }

    jumpBall();
    earnings += 1;
    elapsed++;
    earningsText.textContent = `💰 أرباحك: ${earnings} TRX`;

  }, 100); // كل 0.1 ثانية (سرعة توليد أرباح عالية)
}

function jumpBall() {
  ball.style.transition = "bottom 0.1s";
  ball.style.bottom = "200px";

  setTimeout(() => {
    ball.style.bottom = "0px";
  }, 100);
}

startBtn.addEventListener("click", startMining);

withdrawBtn.addEventListener("click", () => {
  if (earnings <= 0) {
    alert("⚠️ لا يوجد أرباح لسحبها.");
    return;
  }

  const address = prompt("📩 أدخل عنوان محفظتك (TRX):");

  if (!address || !address.startsWith("T") || address.length < 25) {
    alert("❌ عنوان TRX غير صالح.");
    return;
  }

  alert(
    `✅ تم حفظ طلب السحب بنجاح!\nسيتم تحويل ${earnings} TRX إلى ${address} عندما يتوفر رصيد كافٍ.`
  );

  // في النسخة الحقيقية: أرسل الطلب إلى الخادم (backend)
  // reset
  earnings = 0;
  earningsText.textContent = `💰 أرباحك: 0 TRX`;
  statusText.textContent = "⏳ لم يبدأ التعدين بعد.";
});
