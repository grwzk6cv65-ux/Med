import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  KeyRound,
  LifeBuoy,
  Lock,
  Mail,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMedradar } from '../context/MedradarContext';
import {
  fetchSupportTickets,
  submitSupportEmail,
  updateSupportTicketStatus,
} from '../services/api';
import { SupportTicket, SupportTicketStatus } from '../types/medradar';

export function SupportRequestsView() {
  const { t, language, activeModule } = useMedradar();
  const { user, isAuthenticated, isSupportTeam, configStatus, openAuthModal, unlockSupportTeam } =
    useAuth();

  const [tab, setTab] = useState<'mine' | 'team'>('mine');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Direct Support Form
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [replyEmail, setReplyEmail] = useState(user?.email ?? '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneE164 ?? '');
  const [pageFeature, setPageFeature] = useState<string>(activeModule);
  const [sending, setSending] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
    missingVars?: string[];
  } | null>(null);

  // Support Team Passcode Unlock
  const [passcode, setPasscode] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email && !replyEmail) setReplyEmail(user.email);
    if (user?.phoneE164 && !phoneNumber) setPhoneNumber(user.phoneE164);
  }, [user, replyEmail, phoneNumber]);

  const loadTickets = useCallback(async () => {
    if (tab === 'mine' && !isAuthenticated) {
      setTickets([]);
      return;
    }
    if (tab === 'team' && !isSupportTeam) {
      setTickets([]);
      return;
    }

    setLoadingTickets(true);
    try {
      const { status, data } = await fetchSupportTickets(tab);
      if (status >= 200 && status < 300 && data.ok && data.tickets) {
        setTickets(data.tickets);
      } else {
        setTickets([]);
      }
    } catch {
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  }, [tab, isAuthenticated, isSupportTeam]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitFeedback(null);

    if (message.trim().length < 8) {
      setSubmitFeedback({
        type: 'error',
        text:
          language === 'ru'
            ? 'Пожалуйста, опишите проблему подробнее (минимум 8 символов).'
            : language === 'kk'
              ? 'Мәселені толығырақ сипаттаңыз (кемінде 8 таңба).'
              : 'Please describe your issue in at least 8 characters.',
      });
      return;
    }

    if (!replyEmail.trim() && !phoneNumber.trim()) {
      setSubmitFeedback({
        type: 'error',
        text:
          language === 'ru'
            ? 'Укажите email или номер телефона для ответа.'
            : language === 'kk'
              ? 'Жауап алу үшін email немесе телефон нөмірін енгізіңіз.'
              : 'Please provide an email address or phone number for a reply.',
      });
      return;
    }

    setSending(true);
    const { status, data } = await submitSupportEmail({
      subject: subject.trim() || 'MEDRADAR Technical Support Request',
      message: message.trim(),
      replyEmail: replyEmail.trim(),
      phoneNumber: phoneNumber.trim(),
      submittedByName: user?.fullName || undefined,
      pageFeature,
    });
    setSending(false);

    if (status >= 200 && status < 300 && data.ok && data.emailSent && data.ticket) {
      setSubmitFeedback({
        type: 'success',
        text:
          language === 'ru'
            ? `Ваше сообщение отправлено нашей команде поддержки! Номер вашего обращения: ${data.ticket.ticketNumber}. Мы свяжемся с вами как можно скорее.`
            : language === 'kk'
              ? `Хабарламаңыз қолдау тобымызға жіберілді! Өтінім нөмірі: ${data.ticket.ticketNumber}. Сізбен мүмкіндігінше тезірек хабарласамыз.`
              : `Your message has been sent to our support team! Your ticket number is ${data.ticket.ticketNumber}. We will contact you as soon as possible.`,
      });
      setSubject('');
      setMessage('');
      void loadTickets();
      return;
    }

    // Strict honesty: NEVER show email-sent success if emailSent !== true
    setSubmitFeedback({
      type: 'warning',
      text: data.ticket
        ? `${data.error || 'Email was NOT delivered.'} (Saved under ${data.ticket.ticketNumber} with status "${data.ticket.status}")`
        : data.error || 'Support email could not be sent.',
      missingVars: data.missingVars,
    });
    if (data.ticket) void loadTickets();
  };

  const handleUnlockTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);
    const res = await unlockSupportTeam(passcode);
    if (!res.ok) {
      setUnlockError(res.error || 'Authorization failed.');
      return;
    }
    setPasscode('');
    void loadTickets();
  };

  const handleStatusChange = async (ticketId: string, nextStatus: SupportTicketStatus) => {
    const { status, data } = await updateSupportTicketStatus(ticketId, nextStatus);
    if (status >= 200 && status < 300 && data.ok && data.ticket) {
      setTickets((prev) => prev.map((tk) => (tk.id === ticketId ? data.ticket! : tk)));
    }
  };

  const statusBadge = (st: SupportTicketStatus) => {
    if (st === 'Resolved') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-md">
          <CheckCircle2 className="w-3 h-3" />
          <span>{t('support_status_resolved')}</span>
        </span>
      );
    }
    if (st === 'In Progress') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-zinc-950 text-emerald-400 rounded-md">
          <Clock className="w-3 h-3" />
          <span>{t('support_status_in_progress')}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 rounded-md">
        <LifeBuoy className="w-3 h-3" />
        <span>{t('support_status_new')}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">{t('support_title')}</h1>
          <p className="mt-1 text-sm text-zinc-600 max-w-3xl">{t('support_sub')}</p>
        </div>
      </div>

      {/* Server Config Status Strip */}
      {configStatus && (
        <div className="bg-zinc-950 text-white border border-zinc-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <div className="text-zinc-400 font-semibold uppercase tracking-wide text-[11px]">
              {t('support_config_card_title')}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span
                className={`px-2 py-0.5 rounded font-semibold ${
                  configStatus.emailConfigured
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                SMTP Email: {configStatus.emailConfigured ? 'Ready' : 'Not Configured'}
              </span>
              <span
                className={`px-2 py-0.5 rounded font-semibold ${
                  configStatus.smsConfigured
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                Twilio SMS OTP: {configStatus.smsConfigured ? 'Ready' : 'Not Configured'}
              </span>
            </div>
            <div className="text-zinc-400 font-mono text-[11px] pt-1">
              SUPPORT_EMAIL={configStatus.supportEmailPreview}
            </div>
          </div>

          {(!configStatus.emailConfigured || !configStatus.smsConfigured) && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-[11px] font-mono text-zinc-300 space-y-1">
              <div className="font-sans font-semibold text-emerald-400">
                Required Server Variables (.env):
              </div>
              {configStatus.missingEmailVars.length > 0 && (
                <div>Email: {configStatus.missingEmailVars.join(', ')}</div>
              )}
              {configStatus.missingSmsVars.length > 0 && (
                <div>SMS: {configStatus.missingSmsVars.join(', ')}</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Send Support Request Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl p-5 space-y-4"
        >
          <div className="pb-3 border-b border-zinc-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-950 flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-600" />
              <span>{t('support_new_btn')}</span>
            </h2>
          </div>

          {submitFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs space-y-1 ${
                submitFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : submitFeedback.type === 'warning'
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <div className="flex items-start gap-2 font-medium">
                {submitFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                )}
                <span>{submitFeedback.text}</span>
              </div>
              {submitFeedback.missingVars && submitFeedback.missingVars.length > 0 && (
                <div className="font-mono text-[11px] pl-6 text-zinc-800">
                  Missing: {submitFeedback.missingVars.join(', ')}
                </div>
              )}
            </div>
          )}

          <div>
            <label htmlFor="sup-subject" className="block text-xs font-medium text-zinc-700 mb-1">
              {t('support_subject_label')}
            </label>
            <input
              id="sup-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Cannot book referral / Login problem"
              className="w-full h-10 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label htmlFor="sup-page" className="block text-xs font-medium text-zinc-700 mb-1">
              {t('support_page_label')}
            </label>
            <select
              id="sup-page"
              value={pageFeature}
              onChange={(e) => setPageFeature(e.target.value)}
              className="w-full h-10 px-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
            >
              <option value="dashboard">{t('nav_dashboard')}</option>
              <option value="map">{t('nav_map')}</option>
              <option value="rapid_lab">{t('nav_rapid_lab')}</option>
              <option value="ai_radar">{t('nav_ai_radar')}</option>
              <option value="medmobile">{t('nav_medmobile')}</option>
              <option value="passport_referrals">{t('nav_passport_referrals')}</option>
              <option value="care_loop">{t('nav_care_loop')}</option>
              <option value="analytics">{t('nav_analytics')}</option>
              <option value="auth">Registration / Login</option>
              <option value="nano">NANO AI Assistant</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="sup-email" className="block text-xs font-medium text-zinc-700 mb-1">
                {t('support_contact_email_label')}
              </label>
              <input
                id="sup-email"
                type="email"
                value={replyEmail}
                onChange={(e) => setReplyEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-10 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label htmlFor="sup-phone" className="block text-xs font-medium text-zinc-700 mb-1">
                {t('support_contact_phone_label')}
              </label>
              <input
                id="sup-phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+7 701 555 0101"
                className="w-full h-10 px-3 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="sup-msg" className="block text-xs font-medium text-zinc-700 mb-1">
              {t('support_issue_label')} *
            </label>
            <textarea
              id="sup-msg"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              required
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full h-10 inline-flex items-center justify-center gap-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded-lg transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{sending ? t('support_sending_btn') : t('support_submit_btn')}</span>
          </button>
        </form>

        {/* Right: Ticket Tracking (Scoped Private vs Support Team Review) */}
        <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-200">
            <div className="inline-flex items-center p-1 bg-zinc-100 border border-zinc-200 rounded-xl">
              <button
                type="button"
                onClick={() => setTab('mine')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  tab === 'mine' ? 'bg-zinc-950 text-white' : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {t('support_my_tab')}
              </button>
              <button
                type="button"
                onClick={() => setTab('team')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 ${
                  tab === 'team' ? 'bg-zinc-950 text-white' : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('support_team_tab')}</span>
              </button>
            </div>
          </div>

          {tab === 'mine' && !isAuthenticated ? (
            <div className="p-6 text-center bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
              <Lock className="w-6 h-6 text-emerald-600 mx-auto" />
              <p className="text-xs text-zinc-700 max-w-md mx-auto leading-relaxed">
                {t('support_signin_required')}
              </p>
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg"
              >
                {t('auth_btn_signin')}
              </button>
            </div>
          ) : tab === 'team' && !isSupportTeam ? (
            <form
              onSubmit={handleUnlockTeam}
              className="p-5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3"
            >
              <div className="text-sm font-semibold text-zinc-950 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-600" />
                <span>{t('support_team_unlock_title')}</span>
              </div>
              <p className="text-xs text-zinc-600">{t('support_team_unlock_desc')}</p>
              {unlockError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                  {unlockError}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder={t('support_team_passcode_label')}
                  className="flex-1 h-10 px-3 text-xs bg-white border border-zinc-200 rounded-lg"
                  required
                />
                <button
                  type="submit"
                  className="px-4 h-10 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg whitespace-nowrap"
                >
                  {t('support_team_unlock_btn')}
                </button>
              </div>
            </form>
          ) : loadingTickets ? (
            <div className="py-8 text-center text-xs text-zinc-500">Loading tickets...</div>
          ) : tickets.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">{t('support_empty_mine')}</div>
          ) : (
            <div className="divide-y divide-zinc-200">
              {tickets.map((tk) => (
                <div key={tk.id} className="py-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-zinc-950">
                        {tk.ticketNumber}
                      </span>
                      {statusBadge(tk.status)}
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${
                          tk.emailDelivery.sent
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-amber-50 border-amber-200 text-amber-800'
                        }`}
                      >
                        {tk.emailDelivery.sent
                          ? t('support_email_sent_badge')
                          : t('support_email_not_sent_badge')}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-zinc-500">
                      {tk.createdAt.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-zinc-950">{tk.subject}</div>
                  <p className="text-xs text-zinc-700 leading-relaxed whitespace-pre-line">
                    {tk.message}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
                    <div>
                      {tk.pageFeature} · {tk.submittedByName} · {tk.replyEmail || tk.phoneNumber}
                    </div>
                    {tab === 'team' && (
                      <select
                        value={tk.status}
                        onChange={(e) =>
                          handleStatusChange(tk.id, e.target.value as SupportTicketStatus)
                        }
                        aria-label={`Update status for ${tk.ticketNumber}`}
                        className="h-8 px-2 text-xs font-medium bg-zinc-50 border border-zinc-200 rounded-md text-zinc-950"
                      >
                        <option value="New">{t('support_status_new')}</option>
                        <option value="In Progress">{t('support_status_in_progress')}</option>
                        <option value="Resolved">{t('support_status_resolved')}</option>
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
