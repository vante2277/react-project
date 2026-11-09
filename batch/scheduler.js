// 의존성 없는 스케줄러: 매주(또는 매일) 정해진 한국 시간(요일 HH:MM)에 작업을 실행합니다.
// cron 의 '0 9 * * 1'(매주 월요일 09:00) 과 같은 동작을 setTimeout 으로 직접 구현한 것입니다.
const KST = 9 * 3600e3;
const DAY = 24 * 3600e3;

export const WEEKDAYS = '일월화수목금토';

// 지금 이후 가장 가까운 '요일 HH:MM (KST)' 시각. weekday(0=일 … 6=토)를 생략하면 매일.
export function nextRunAt({ time, weekday }, now = Date.now()) {
  const [h, m] = time.split(':').map(Number);
  const kst = new Date(now + KST);
  let target = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), h, m) - KST;
  if (weekday != null) target += ((weekday - kst.getUTCDay() + 7) % 7) * DAY;
  if (target <= now) target += weekday != null ? 7 * DAY : DAY;
  return target;
}

// runOnStart: 서버가 꺼져 있어 놓친 실행을 켜자마자 보충(catch-up)합니다. 작업 쪽에서 중복은 걸러집니다.
export function startSchedule(name, schedule, job, { runOnStart = true } = {}) {
  let timer;
  const plan = () => {
    const at = nextRunAt(schedule);
    console.log(`[${name}] 다음 실행: ${new Date(at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    timer = setTimeout(async () => {
      await job('schedule').catch(err => console.error(`[${name}]`, err));
      plan();
    }, at - Date.now());
    timer.unref?.(); // 타이머 때문에 프로세스가 종료되지 못하는 일이 없게
  };

  if (runOnStart) job('startup').catch(err => console.error(`[${name}]`, err));
  plan();
  return () => clearTimeout(timer);
}
