export const PIN_LENGTH = 6;
export const IDLE_LOCK_MS = 5 * 60 * 1000;
export const SECURITY_QUESTIONS = [
  { id: 'childhood-nickname', label: 'What was your childhood nickname?' },
  { id: 'first-school', label: 'What was the name of your first school?' },
  { id: 'memorable-place', label: 'What place is most memorable to you?' },
];
export const validPin = (pin) => typeof pin === 'string' && /^\d{6}$/.test(pin);
export const normalizeAnswer = (answer) => typeof answer === 'string' ? answer.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US') : '';
