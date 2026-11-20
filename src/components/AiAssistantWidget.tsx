import { AlertTriangle, ArrowUpRight, BellPlus, CheckCircle2, LifeBuoy, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMedradar } from '../context/MedradarContext';
import { submitSupportEmail } from '../services/api';
import { PreventiveReminder } from '../types/medradar';
import { AssistantAction, generateAssistantReply } from '../utils/aiAssistantEngine';
import { validateReminderInput } from '../utils/validation';
import { NanoCharacter } from './NanoCharacter';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  actions?: AssistantAction[];
  offeredSupport?: boolean;
}

export function AiAssistantWidget() {
  const {
    t,
    language,
    role,
    activeModule,
    patients,
    activePatientId,
    setActivePatientId,
    clusters,
    villages,
    rapidLabs,
    medMobileSchedule,
    referrals,
    reminders,
    addPreventiveReminder,
    setActiveModule,
    setSelectedVillageId,
    highlightedTourTarget,
  } = useMedradar();
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Inline Reminder Form
  const [showRemForm, setShowRemForm] = useState(false);
  const [remTitle, setRemTitle] = useState('');
  const [remCat, setRemCat] = useState<PreventiveReminder['category']>('appointment');
  const [remDate, setRemDate] = useState('2026-11-24');
  const [remTime, setRemTime] = useState('10:00');
  const [remErrors, setRemErrors] = useState<Record<string, string>>({});

  // Inline NANO Support Escalation Form
  const [showSupportForm, setShowSupportForm] = useState(false);
  const [supMessage, setSupMessage] = useState('');
  const [supEmail, setSupEmail] = useState(user?.email ?? '');
  const [supPhone, setSupPhone] = useState(user?.phoneE164 ?? '');
  const [supSending, setSupSending] = useState(false);
  const [supError, setSupError] = useState<string | null>(null);
  const [lastUserIssue, setLastUserIssue] = useState('');

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const activePatient = patients.find((p) => p.id === activePatientId) ?? patients[0];
  const isHighlighted = highlightedTourTarget === 'nano';

  useEffect(() => {
    if (user?.email && !supEmail) setSupEmail(user.email);
    if (user?.phoneE164 && !supPhone) setSupPhone(user.phoneE164);
  }, [user, supEmail, supPhone]);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 0 || (prev.length === 1 && prev[0].id === 'welcome')) {
        return [
          {
            id: 'welcome',
            sender: 'assistant',
            text: t('ai_welcome'),
          },
        ];
      }
      return prev;
    });
  }, [language, t]);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, showRemForm, showSupportForm]);

  useEffect(() => {
    const handleOpenNano = () => setIsOpen(true);
    window.addEventListener('medradar:open-nano', handleOpenNano);
    return () => window.removeEventListener('medradar:open-nano', handleOpenNano);
  }, []);

  const openSupportComposer = (prefillIssue?: string) => {
    setShowRemForm(false);
    setSupError(null);
    if (prefillIssue && !supMessage.trim()) {
      setSupMessage(prefillIssue);
    }
    setShowSupportForm(true);
  };

  const sendQuery = (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: trimmed,
    };

    const lastAssistant = [...messages].reverse().find((m) => m.sender === 'assistant');
    const qLower = trimmed.toLowerCase();
    const isAffirmative =
      ['yes', 'yeah', 'yep', 'ok', 'okay', 'sure', 'please', 'да', 'хочу', 'ок', 'иә', 'ия', 'жарайды'].includes(
        qLower
      );

    // If NANO just offered support and user replied "Yes", open the support request form directly
    if (lastAssistant?.offeredSupport && isAffirmative) {
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: `a-sup-open-${Date.now()}`,
          sender: 'assistant',
          text:
            language === 'ru'
              ? 'Хорошо! Заполните детали обращения ниже — я передам запрос на официальный email поддержки MEDRADAR.'
              : language === 'kk'
                ? 'Жақсы! Төмендегі өтінім өрістерін толтырыңыз — хабарламаны MEDRADAR ресми қолдау поштасына жіберемін.'
                : 'Got it! Please confirm your issue description and contact details below so I can email our support team.',
        },
      ]);
      setInput('');
      openSupportComposer(lastUserIssue);
      return;
    }

    const reply = generateAssistantReply(trimmed, {
      language,
      role,
      activePatient,
      clusters,
      villages,
      patients,
      rapidLabs,
      medMobileSchedule,
      referrals,
      reminders,
    });

    if (reply.offeredSupport && trimmed.length > 6 && !qLower.includes('contact support')) {
      setLastUserIssue(trimmed);
    }

    const botMsg: ChatMessage = {
      id: `a-${Date.now() + 1}`,
      sender: 'assistant',
      text: reply.text,
      actions: reply.actions,
      offeredSupport: reply.offeredSupport,
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput('');
  };

  const handleActionClick = (act: AssistantAction) => {
    if (act.openSupportForm) {
      openSupportComposer(lastUserIssue);
      return;
    }
    if (act.openReminderForm) {
      setShowSupportForm(false);
      setShowRemForm(true);
      return;
    }
    if (act.patientId) setActivePatientId(act.patientId);
    if (act.villageId) setSelectedVillageId(act.villageId);
    if (act.module) setActiveModule(act.module);
  };

  const handleSaveReminder = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateReminderInput(
      { title: remTitle, dueDate: remDate, dueTime: remTime },
      language
    );
    if (!validation.valid) {
      setRemErrors(validation.errors);
      return;
    }

    addPreventiveReminder({
      patientId: activePatient.id,
      title: remTitle.trim(),
      category: remCat,
      dueDate: remDate,
      dueTime: remTime.trim() || undefined,
      priority: 'priority',
    });

    setRemErrors({});
    setRemTitle('');
    setShowRemForm(false);

    setMessages((prev) => [
      ...prev,
      {
        id: `a-rem-${Date.now()}`,
        sender: 'assistant',
        text:
          language === 'ru'
            ? `Готово! Напоминание для ${activePatient.fullName} на ${remDate} ${remTime} сохранено.`
            : language === 'kk'
              ? `Дайын! ${activePatient.fullName} үшін ${remDate} ${remTime} еске салғышы сақталды.`
              : `Done! Saved a reminder for ${activePatient.fullName} on ${remDate} at ${remTime}.`,
        actions: [{ label: t('nav_care_loop'), module: 'care_loop', patientId: activePatient.id }],
      },
    ]);
  };

  const handleSendSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupError(null);

    if (supMessage.trim().length < 8) {
      setSupError(
        language === 'ru'
          ? 'Опишите проблему подробнее (минимум 8 символов).'
          : language === 'kk'
            ? 'Мәселені толығырақ жазыңыз (кемінде 8 таңба).'
            : 'Please describe the issue in at least 8 characters.'
      );
      return;
    }

    if (!supEmail.trim() && !supPhone.trim()) {
      setSupError(
        language === 'ru'
          ? 'Укажите email или телефон для обратной связи.'
          : language === 'kk'
            ? 'Жауап беру үшін email немесе телефон енгізіңіз.'
            : 'Please enter a reply email or phone number.'
      );
      return;
    }

    setSupSending(true);
    const { status, data } = await submitSupportEmail({
      subject: `NANO Support Request (${activeModule})`,
      message: supMessage.trim(),
      replyEmail: supEmail.trim(),
      phoneNumber: supPhone.trim(),
      submittedByName: user?.fullName || undefined,
      pageFeature: activeModule,
    });
    setSupSending(false);

    if (status >= 200 && status < 300 && data.ok && data.emailSent && data.ticket) {
      setShowSupportForm(false);
      setSupMessage('');
      setLastUserIssue('');

      const confirmText =
        language === 'ru'
          ? `Ваше сообщение отправлено нашей команде поддержки! Номер вашего обращения: ${data.ticket.ticketNumber}. Мы свяжемся с вами как можно скорее.`
          : language === 'kk'
            ? `Хабарламаңыз қолдау тобымызға жіберілді! Өтінім нөмірі: ${data.ticket.ticketNumber}. Сізбен мүмкіндігінше тезірек хабарласамыз.`
            : `Your message has been sent to our support team! Your ticket number is ${data.ticket.ticketNumber}. We will contact you as soon as possible.`;

      setMessages((prev) => [
        ...prev,
        {
          id: `a-sup-ok-${Date.now()}`,
          sender: 'assistant',
          text: confirmText,
          actions: [{ label: t('nav_support'), module: 'support' }],
        },
      ]);
      return;
    }

    // Strict honesty: NEVER claim the email was sent if emailSent !== true
    setShowSupportForm(false);
    const failureNotice = data.ticket
      ? language === 'ru'
        ? `Внимание: письмо в поддержку НЕ было отправлено (${data.error || 'SMTP не настроен'}). Заявка сохранена локально под номером ${data.ticket.ticketNumber}.${data.missingVars?.length ? ` Требуемые переменные: ${data.missingVars.join(', ')}` : ''}`
        : language === 'kk'
          ? `Назар аударыңыз: қолдау поштасына хат ЖІБЕРІЛМЕДІ (${data.error || 'SMTP бапталмаған'}). Өтінім ${data.ticket.ticketNumber} нөмірімен сақталды.${data.missingVars?.length ? ` Қажетті айнымалылар: ${data.missingVars.join(', ')}` : ''}`
          : `Important: Your email was NOT sent because email delivery failed or is not configured (${data.error || 'SMTP not configured'}). Your request was saved locally as ${data.ticket.ticketNumber}.${data.missingVars?.length ? ` Required server vars: ${data.missingVars.join(', ')}` : ''}`
      : data.error || 'Could not send support request.';

    setMessages((prev) => [
      ...prev,
      {
        id: `a-sup-fail-${Date.now()}`,
        sender: 'assistant',
        text: failureNotice,
        actions: [{ label: t('nav_support'), module: 'support' }],
      },
    ]);
  };

  const quickPrompts = [
    t('support_nano_chip'),
    t('ai_chip_appointments'),
    t('ai_chip_prep'),
    t('ai_chip_remind'),
    t('ai_chip_how'),
  ];

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end">
      {isOpen && (
        <div
          className="mb-3 w-[368px] max-w-[calc(100vw-2rem)] h-[510px] max-h-[78vh] bg-white border border-zinc-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          role="dialog"
          aria-label={t('ai_title')}
        >
          {/* Matte Black NANO Header */}
          <div className="px-4 py-3 bg-zinc-950 text-white flex items-center justify-between gap-2 shrink-0 border-b border-zinc-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <NanoCharacter size={34} mood="helpful" animate />
              <div className="min-w-0">
                <div className="text-xs font-bold tracking-tight truncate">{t('ai_title')}</div>
                <div className="text-[11px] text-emerald-400 truncate">{t('ai_sub')}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => openSupportComposer()}
                title={t('nav_support')}
                className="px-2 py-1 text-[11px] font-semibold bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-zinc-700 rounded-md transition-colors whitespace-nowrap inline-flex items-center gap-1"
              >
                <LifeBuoy className="w-3 h-3" />
                <span>Support</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSupportForm(false);
                  setShowRemForm((v) => !v);
                }}
                className="px-2 py-1 text-[11px] font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-md transition-colors whitespace-nowrap"
              >
                {t('ai_quick_remind_btn')}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors"
                aria-label="Close NANO"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Viewport */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-zinc-50/70">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] px-3.5 py-2.5 rounded-xl text-xs leading-relaxed whitespace-pre-line ${
                    msg.sender === 'user'
                      ? 'bg-zinc-950 text-white'
                      : 'bg-white border border-zinc-200 text-zinc-800 shadow-2xs'
                  }`}
                >
                  {msg.text}
                </div>

                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 max-w-[92%]">
                    {msg.actions.map((act, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleActionClick(act)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                      >
                        <span>{act.label}</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Inline Support Request Form inside NANO */}
            {showSupportForm && (
              <form
                onSubmit={handleSendSupport}
                className="p-3 bg-white border border-emerald-300 rounded-xl space-y-2.5 shadow-xs"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-950">
                  <span className="flex items-center gap-1.5">
                    <LifeBuoy className="w-3.5 h-3.5 text-emerald-600" />
                    {t('support_new_btn')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSupportForm(false)}
                    className="text-zinc-400 hover:text-zinc-700"
                    aria-label={t('support_nano_cancel_btn')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {supError && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-800 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{supError}</span>
                  </div>
                )}

                <textarea
                  rows={3}
                  value={supMessage}
                  onChange={(e) => setSupMessage(e.target.value)}
                  placeholder={t('support_issue_label')}
                  className="w-full p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  required
                />

                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="email"
                    value={supEmail}
                    onChange={(e) => setSupEmail(e.target.value)}
                    placeholder={t('support_contact_email_label')}
                    className="w-full h-8 px-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                  />
                  <input
                    type="tel"
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    placeholder={t('support_contact_phone_label')}
                    className="w-full h-8 px-2 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg"
                  />
                </div>

                <div className="text-[10px] font-mono text-zinc-500 flex items-center justify-between">
                  <span>Page: {activeModule}</span>
                  <span>{new Date().toISOString().slice(0, 16).replace('T', ' ')}</span>
                </div>

                <button
                  type="submit"
                  disabled={supSending}
                  className="w-full py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 disabled:opacity-60 rounded-lg inline-flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{supSending ? t('support_sending_btn') : t('support_submit_btn')}</span>
                </button>
              </form>
            )}

            {/* Validated Inline Reminder Creator inside NANO Chat */}
            {showRemForm && (
              <form
                onSubmit={handleSaveReminder}
                noValidate
                className="p-3 bg-white border border-emerald-300 rounded-xl space-y-2 shadow-xs"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-950">
                  <span className="flex items-center gap-1.5">
                    <BellPlus className="w-3.5 h-3.5 text-emerald-600" />
                    {t('rem_add')} ({activePatient.fullName})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRemForm(false)}
                    className="text-zinc-400 hover:text-zinc-700"
                    aria-label={t('rem_cancel')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <input
                    type="text"
                    value={remTitle}
                    onChange={(e) => setRemTitle(e.target.value)}
                    placeholder={t('rem_cat_appointment')}
                    aria-invalid={Boolean(remErrors.title)}
                    className={`w-full h-8 px-2.5 text-xs rounded-lg border ${
                      remErrors.title ? 'border-red-500 bg-red-50/40' : 'border-zinc-200 bg-zinc-50'
                    }`}
                  />
                  {remErrors.title && (
                    <p className="text-[11px] text-red-600 mt-0.5">{remErrors.title}</p>
                  )}
                </div>

                <select
                  value={remCat}
                  onChange={(e) => setRemCat(e.target.value as PreventiveReminder['category'])}
                  className="w-full h-8 px-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                >
                  <option value="appointment">{t('rem_cat_appointment')}</option>
                  <option value="examination">{t('rem_cat_examination')}</option>
                  <option value="lab_result">{t('rem_cat_lab_result')}</option>
                  <option value="follow_up">{t('rem_cat_follow_up')}</option>
                  <option value="personal_task">{t('rem_cat_personal_task')}</option>
                </select>

                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <input
                      type="date"
                      value={remDate}
                      onChange={(e) => setRemDate(e.target.value)}
                      aria-invalid={Boolean(remErrors.dueDate)}
                      className={`w-full h-8 px-2 text-xs font-mono rounded-lg border ${
                        remErrors.dueDate ? 'border-red-500 bg-red-50/40' : 'border-zinc-200 bg-zinc-50'
                      }`}
                    />
                    {remErrors.dueDate && (
                      <p className="text-[10px] text-red-600 mt-0.5">{remErrors.dueDate}</p>
                    )}
                  </div>
                  <div>
                    <input
                      type="time"
                      value={remTime}
                      onChange={(e) => setRemTime(e.target.value)}
                      aria-invalid={Boolean(remErrors.dueTime)}
                      className={`w-full h-8 px-2 text-xs font-mono rounded-lg border ${
                        remErrors.dueTime ? 'border-red-500 bg-red-50/40' : 'border-zinc-200 bg-zinc-50'
                      }`}
                    />
                    {remErrors.dueTime && (
                      <p className="text-[10px] text-red-600 mt-0.5">{remErrors.dueTime}</p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-1.5 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg"
                >
                  {t('rem_save')}
                </button>
              </form>
            )}
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-3 py-2 bg-white border-t border-zinc-100 flex items-center gap-1.5 overflow-x-auto shrink-0">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendQuery(prompt)}
                className="px-2.5 py-1 text-[11px] font-medium text-zinc-700 bg-zinc-100 hover:bg-emerald-50 hover:text-emerald-900 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuery(input);
            }}
            className="p-2.5 bg-white border-t border-zinc-200 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('ai_placeholder')}
              className="flex-1 h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
            />
            <button
              type="submit"
              aria-label={t('ai_send')}
              className="h-9 px-3 inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Corner NANO Face Trigger Button (50x50px, Face-Only When Closed) */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-label={t('ai_title')}
        aria-expanded={isOpen}
        title="NANO"
        className={`w-[50px] h-[50px] rounded-2xl bg-zinc-950 hover:bg-zinc-900 border-2 border-emerald-500 shadow-lg flex items-center justify-center transition-transform hover:scale-105 ${
          isHighlighted ? 'tour-highlight-ring' : ''
        }`}
      >
        {isOpen ? (
          <X className="w-5 h-5 text-emerald-400" />
        ) : (
          <NanoCharacter size={38} mood="happy" animate />
        )}
      </button>
    </div>
  );
}
