'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';

const VISION_EN: readonly string[] = [
  'I am someone who is consistent, healthy, and present for the people I love.',
  'I am the version of myself who shows up — especially when it is hard.',
  'I am a person who reads more than I scroll, and listens more than I talk.',
  'I am the kind of friend, parent, partner I always wanted to be.',
  'I am someone whose mornings are quiet and whose evenings are kind.',
  'I am the version of myself who follows through on what I say.',
  'I am a person whose body, mind, and finances are all moving in the right direction.',
  'I am someone who has built a life I do not need to escape from.',
  'I am the version of myself who chose discipline over comfort and never regretted it.',
  'I am someone whose words and actions match.',
  'I am a person who reads, learns, and builds — every single day, even if just a little.',
  'I am the version of myself who treats my time like it matters.',
  'I am someone who has stopped negotiating with my own bad habits.',
  'I am a person who has the energy and clarity to give to the work I love.',
  'I am the version of myself who is not waiting for motivation.',
  'I am someone whose health, sleep, and focus all compound in my favour.',
  'I am a person who is patient with the small steps because I trust the math.',
  'I am the kind of person who takes care of my body, my faith, and my family.',
  'I am someone who reads dozens of books a year and remembers them.',
  'I am a person who keeps a clean environment and a clean conscience.',
  'I am the version of myself who has the courage to do the hard things first.',
  'I am someone who walks in the morning, eats deliberately, and sleeps early.',
  'I am a person whose phone does not run my life.',
  'I am the version of myself who saves before I spend.',
  'I am someone who chose to be in the arena, not the stands.',
  'I am a person who has invested years in becoming someone I am proud of.',
  'I am the version of myself who gets stronger every season.',
  'I am someone whose presence is calming, not draining.',
  'I am a person who has more to give than to take.',
  'I am the version of myself who is kinder than I had to be, and steadier than I thought I could be.',
];

const VISION_FA: readonly string[] = [
  'من کسی هستم پایدار، سالم، و در کنارِ کسانی که دوست‌شان دارم.',
  'من نسخه‌ای از خودم هستم که همیشه حاضر می‌شوم — به‌ویژه وقتی سخت است.',
  'من کسی هستم که بیش از آن‌که اسکرول کنم می‌خوانم، و بیش از آن‌که حرف بزنم گوش می‌دهم.',
  'من همان دوست، والد، همسری هستم که همیشه می‌خواستم باشم.',
  'من کسی هستم که صبح‌هایش آرام و شب‌هایش مهربان است.',
  'من نسخه‌ای از خودم هستم که به آن‌چه می‌گویم عمل می‌کنم.',
  'من کسی هستم که تن، ذهن، و حساب‌بانکی‌ام، هر سه در مسیرِ درست حرکت می‌کنند.',
  'من کسی هستم که زندگی‌ای ساخته‌ام که نیازی نیست از آن فرار کنم.',
  'من نسخه‌ای از خودم هستم که نظم را به‌جای راحتی برگزیدم و هرگز پشیمان نشدم.',
  'من کسی هستم که حرف و عملم یکی است.',
  'من کسی هستم که می‌خوانم، یاد می‌گیرم و می‌سازم — هر روز، حتی اندک.',
  'من نسخه‌ای از خودم هستم که با وقتم چنان رفتار می‌کنم که گویی ارزش دارد.',
  'من کسی هستم که دیگر با عادت‌های بدِ خودش معامله نمی‌کند.',
  'من کسی هستم که انرژی و تمرکزِ کافی دارد تا به کارِ موردِ علاقه‌اش بدهد.',
  'من نسخه‌ای از خودم هستم که منتظرِ انگیزه نمی‌مانم.',
  'من کسی هستم که سلامتی، خواب و تمرکزش، همه در سودش جمع می‌شود.',
  'من کسی هستم که با قدم‌های کوچک صبورم چون به ریاضی‌اش ایمان دارم.',
  'من کسی هستم که از تن، ایمان و خانواده‌اش نگه‌داری می‌کند.',
  'من کسی هستم که سالی ده‌ها کتاب می‌خواند و یادش می‌ماند.',
  'من کسی هستم که محیطی پاک و وجدانی پاک دارد.',
  'من نسخه‌ای از خودم هستم که جراتِ این را دارم که سختی‌ها را اول انجام دهم.',
  'من کسی هستم که صبح‌ها قدم می‌زنم، آگاهانه می‌خورم، و زود می‌خوابم.',
  'من کسی هستم که گوشی‌اش زندگی‌اش را اداره نمی‌کند.',
  'من نسخه‌ای از خودم هستم که پیش از خرج‌کردن، پس‌انداز می‌کنم.',
  'من کسی هستم که برگزیدم در میدان باشم، نه روی سکو.',
  'من کسی هستم که سال‌ها سرمایه‌گذاری کرده‌ام تا کسی شوم که از خودم راضی‌ام.',
  'من نسخه‌ای از خودم هستم که هر فصل قوی‌تر می‌شود.',
  'من کسی هستم که حضورش آرام‌بخش است، نه فرساینده.',
  'من کسی هستم که برای دادن، بیش از گرفتن چیز دارم.',
  'من نسخه‌ای از خودم هستم که مهربان‌تر از آن‌چه باید و استوارتر از آن‌چه گمان می‌کردم.',
];

const WHY_EN: readonly string[] = [
  'Because the next decade should look different from the last one.',
  'Because I am tired of being someone I do not fully respect.',
  'Because the person I want to become is built one boring day at a time.',
  'Because no one is coming to do this for me.',
  'Because the people who love me deserve the version of me I am capable of becoming.',
  'Because I have had enough of starting over.',
  'Because my future self will either thank me or not — and that depends on today.',
  'Because I am the only person I have to live with for the rest of my life.',
  'Because mediocrity costs more than discipline.',
  'Because if I do not do this now, when?',
  'Because I want to look back and know I tried, properly, at the things that mattered.',
  'Because comfort is the slowest poison I know.',
  'Because the children I will one day have deserve a parent who is steady.',
  'Because every habit either grows me or rots me — there is no neutral.',
  'Because I have wasted enough years already.',
  'Because the version of me I want is not built from one big decision but from a thousand small ones.',
  'Because I want to be the person who does not need to be reminded.',
  'Because I am done waiting for the perfect moment.',
  'Because my problems are not going to solve themselves.',
  'Because I want my mind to be quiet, my body to be strong, and my heart to be at peace.',
  'Because the math compounds, in either direction, whether I notice or not.',
  'Because I have watched what happens to people who never start.',
  'Because the difference between who I am and who I want to be is just a few habits, repeated for a few years.',
  'Because I want to spend my fifties differently than the people who let it slide.',
  'Because I have already lived the version where I let it slide. I know how that ends.',
  'Because I want to be the strongest, most useful person in the room.',
  'Because the people I admire all have one thing in common: they did the work.',
  'Because I am building someone the people I love will be proud to know.',
  'Because I want the freedom that comes with discipline.',
  'Because today is the only day I actually have.',
];

const WHY_FA: readonly string[] = [
  'چون می‌خواهم دههٔ بعدی، با دههٔ گذشته فرق داشته باشد.',
  'چون از این‌که کسی باشم که کاملاً به او احترام نمی‌گذارم، خسته شده‌ام.',
  'چون آن‌کس که می‌خواهم بشوم، با یک روزِ ملال‌آور پس از روزِ دیگر ساخته می‌شود.',
  'چون هیچ‌کس قرار نیست این کار را به‌جای من انجام دهد.',
  'چون آن‌ها که دوستم دارند، شایستهٔ بهترین نسخه‌ای‌اند که می‌توانم باشم.',
  'چون از شروعِ از نو، خسته شده‌ام.',
  'چون نسخهٔ آینده‌ام، یا از من سپاسگزار است یا نه — و این به امروز بستگی دارد.',
  'چون من تنها کسی‌ام که تا آخرِ عمر باید با او زندگی کنم.',
  'چون متوسط‌بودن، گران‌تر از نظم است.',
  'چون اگر اکنون انجام ندهم، پس کِی؟',
  'چون می‌خواهم به عقب نگاه کنم و بدانم در چیزهایِ مهم درست تلاش کرده‌ام.',
  'چون راحتی، آهسته‌ترین زهری است که می‌شناسم.',
  'چون فرزندانی که روزی خواهم داشت، شایستهٔ والدی استوار هستند.',
  'چون هر عادت یا مرا رشد می‌دهد یا می‌پوسد — حالتِ خنثی‌ای نیست.',
  'چون به‌اندازهٔ کافی سال‌ها را هدر داده‌ام.',
  'چون نسخه‌ای از من که می‌خواهم باشم، نه با یک تصمیمِ بزرگ بلکه با هزاران تصمیمِ کوچک ساخته می‌شود.',
  'چون می‌خواهم کسی باشم که نیاز به یادآوری ندارد.',
  'چون از انتظار برای لحظهٔ کامل خسته شده‌ام.',
  'چون مشکلاتم، خودشان حل نمی‌شوند.',
  'چون می‌خواهم ذهنم آرام، تنم قوی، و قلبم در سکون باشد.',
  'چون ریاضی، در هر دو جهت جمع می‌شود — چه متوجه شوم، چه نشوم.',
  'چون دیده‌ام چه بر سرِ کسانی می‌آید که هرگز شروع نکردند.',
  'چون فاصلهٔ بینِ آن‌چه هستم و آن‌چه می‌خواهم باشم، فقط چند عادت است که چند سال تکرار شوند.',
  'چون می‌خواهم پنجاه‌سالگی‌ام را متفاوت از کسانی بگذرانم که رهایش کردند.',
  'چون نسخه‌ای را که در آن همه‌چیز رها شد، تجربه کرده‌ام. می‌دانم چطور تمام می‌شود.',
  'چون می‌خواهم قوی‌ترین و مفیدترین فردِ اتاق باشم.',
  'چون کسانی که تحسین‌شان می‌کنم، همه یک ویژگی دارند: کار را انجام دادند.',
  'چون در حالِ ساختنِ کسی‌ام که افرادِ نزدیک به من به آشنایی با او افتخار خواهند کرد.',
  'چون آزادی‌ای را می‌خواهم که با نظم می‌آید.',
  'چون امروز تنها روزی است که واقعاً دارم.',
];

export type PlaceholderKind = 'vision' | 'why';

function pool(kind: PlaceholderKind, locale: string): readonly string[] {
  if (kind === 'vision') return locale === 'fa' ? VISION_FA : VISION_EN;
  return locale === 'fa' ? WHY_FA : WHY_EN;
}

/** Returns one randomly-picked placeholder from the locale's pool. The
 *  pick is stable for the lifetime of the component (useMemo with [] deps)
 *  so the placeholder doesn't shuffle while the user is typing. */
export function useRandomPlaceholder(kind: PlaceholderKind): string {
  const locale = useLocale();
  return useMemo(() => {
    const arr = pool(kind, locale);
    if (arr.length === 0) return '';
    return arr[Math.floor(Math.random() * arr.length)];
  }, [kind, locale]);
}
