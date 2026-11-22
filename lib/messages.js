'use strict';
// Event-based status copy, taken from proposal §05. Sender and recipient timelines are separate.
const STATUS = {
  invited:          { sender: { en: 'Your surprise has been sent!', ar: 'تم إرسال بطاقة هديتك بنجاح!' }, recipient: { en: 'Someone has a gift for you.', ar: 'هناك هدية تنتظرك!' } },
  started:          { sender: { en: 'Your recipient has opened their gift journey.', ar: 'فتح المستلم رحلة هديته.' }, recipient: { en: 'Your story starts here.', ar: 'قصتك تبدأ من هنا.' } },
  selected:         { sender: { en: 'A gift has been chosen. We are preparing it.', ar: 'اختار المستلم هديته، وبدأنا تجهيزها.' }, recipient: { en: 'Lovely choice! We are on it.', ar: 'اختيار رائع! نجهّز هديتك الآن.' } },
  preparing:        { sender: { en: 'Your gift is being prepared with care.', ar: 'هديتك تُحضَّر بعناية وحب.' }, recipient: { en: 'Something special is coming together.', ar: 'شيء مميز يتشكّل من أجلك.' } },
  out_for_delivery: { sender: { en: 'Your gift is on its way.', ar: 'هديتك في الطريق إلى المستلم.' }, recipient: { en: 'Your gift is on its way to you!', ar: 'هديتك في الطريق إليك!' } },
  delivered:        { sender: { en: 'Your gift was delivered successfully.', ar: 'تم تسليم هديتك بنجاح.' }, recipient: { en: 'Enjoy your gift!', ar: 'نتمنى أن تكون هديتك قد أسعدتك.' } },
  // experience booking states
  date_requested:    { sender: { en: 'Your recipient is picking a date.', ar: 'المستلم يختار موعد التجربة.' }, recipient: { en: 'Date requested. We are confirming with our partner.', ar: 'تم طلب الموعد. نؤكده مع الشريك.' } },
  partner_confirmed: { sender: { en: 'The experience is confirmed.', ar: 'تم تأكيد التجربة.' }, recipient: { en: 'Your experience is confirmed!', ar: 'تم تأكيد تجربتك!' } },
  completed:         { sender: { en: 'The experience was completed. A beautiful moment.', ar: 'اكتملت التجربة. لحظة جميلة.' }, recipient: { en: 'We hope you loved it!', ar: 'نتمنى أن تكون قد أحببتها!' } },
};
const FLOW = {
  physical:   ['invited', 'started', 'selected', 'preparing', 'out_for_delivery', 'delivered'],
  experience: ['invited', 'started', 'selected', 'date_requested', 'partner_confirmed', 'completed'],
};
module.exports = { STATUS, FLOW };
