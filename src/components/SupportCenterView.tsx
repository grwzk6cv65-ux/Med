import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  LifeBuoy,
  Lock,
  Mail,
  MailCheck,
  Phone,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMedradar } from '../context/MedradarContext';
import {
  fetchSupportTickets,
  submitSupportEmail,
  updateSupportTicketStatus,
} from '../services/api';
import type { SupportTicket, SupportTicketStatus } from '../types/medradar';

export function SupportCenterView() {
  const { t, activeModule } = useMedradar();
  const {
    user,
    isSupportTeam,
    configStatus,
    openAuthModal,
    unlockSupportTeam,
    refreshConfigStatus,
  } = useAuth();

  const [tab, setTab] = useState<'mine' | 'team'>('mine');
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [teamTickets, setTeamTickets] = useState<SupportTicket[]>([]);
  const [statusFilter, setStatusFilter] = useState<'All' | SupportTicketStatus>('All');
  const [loadingTickets, setLoadingTickets] = useState(false);

  const [showNewForm, setShowNewForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [replyEmail, setReplyEmail] = useState(user?.email ?? '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneE164 ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{
    emailSent: boolean;
    text: string;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [teamPasscode, setTeamPasscode] = useState('');
  const [teamAuthError, setTeamAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setReplyEmail((prev) => prev || user.email);
      setPhoneNumber((prev) => prev || user.phoneE164);
    }
  }, [user]);

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      if (user) {
        const res = await fetchSupportTickets('mine');
        if (res.status === 200 && res.data.ok && res.data.tickets) {
          setMyTickets(res.data.tickets);
        }
      } else {
        setMyTickets([]);
      }

      if (isSupportTeam) {
        const resTeam = await fetchSupportTickets('team');
        if (resTeam.status === 200 && resTeam.data.ok && resTeam.data.tickets) {
          setTeamTickets(resTeam.data.tickets);
        }
      } else {
        setTeamTickets([]);
      }
    } finally {
      setLoadingTickets(false);
    }
  }, [user, isSupportTeam]);

  useEffect(() => {
    loadTickets();
    refreshConfigStatus();
  }, [loadTickets, refreshConfigStatus]);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitFeedback(null);

    if (message.trim().length < 6) {
      setSubmitError('Please describe the issue (at least 6 characters).');
      return;
    }
    if (!replyEmail.trim() && !phoneNumber.trim()) {
      setSubmitError('Please provide an email address or phone number for a reply.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await submitSupportEmail({
        subject: subject.trim() || 'MEDRADAR Technical Support Request',
        message: message.trim(),
        replyEmail: replyEmail.trim(),
        phoneNumber: phoneNumber.trim(),
        submittedByName: user?.fullName || 'MEDRADAR User',
        pageFeature: t(`nav_${activeModule}`),
      });

      if (data.emailSent && data.ticket) {
        setSubmitFeedback({
          emailSent: true,
          text: `Your message has been sent to our support team! Your ticket number is ${data.ticket.ticketNumber}. We will contact you as soon as possible.`,
        });
        setSubject('');
        setMessage('');
        setShowNewForm(false);
        await loadTickets();
      } else {
        const savedNote = data.ticket
          ? ` Ticket ${data.ticket.ticketNumber} was saved in the support queue, but the email could NOT be sent (${data.error ?? 'SMTP not configured'}).`
          : ` ${data.error ?? 'Email delivery failed.'}`;
        setSubmitError(savedNote);
        await loadTickets();
      }
    } catch {
      setSubmitError('Network error while contacting support backend.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlockTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamAuthError(null);
    const res = await unlockSupportTeam(teamPasscode);
    if (res.ok) {
      setTeamPasscode('');
      await loadTickets();
    } else {
      setTeamAuthError(res.error ?? 'Access denied.');
    }
  };

  const handleChangeStatus = async (ticketId: string, nextStatus: SupportTicketStatus) => {
    const res = await updateSupportTicketStatus(ticketId, nextStatus);
    if (res.status === 200 && res.data.ok) {
      await loadTickets();
    }
  };

  const renderStatusBadge = (status: SupportTicketStatus) => {
    if (status === 'Resolved') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-md">
          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
          <span>{t('support_status_resolved')}</span>
        </span>
      );
    }
    if (status === 'In Progress') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-zinc-950 text-emerald-400 rounded-md">
          <Clock className="w-3 h-3" />
          <span>{t('support_status_in_progress')}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-950 border border-amber-300 rounded-md">
        <Sparkles className="w-3 h-3 text-amber-700" />
        <span>{t('support_status_new')}</span>
      </span>
    );
  };

  const filteredTeamTickets =
    statusFilter === 'All'
      ? teamTickets
      : teamTickets.filter((tk) => tk.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-emerald-600" />
            <span>{t('support_title')}</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-600 max-w-3xl">{t('support_sub')}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowNewForm((s) => !s);
            setSubmitError(null);
            setSubmitFeedback(null);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{t('support_new_btn')}</span>
        </button>
      </div>

      {submitFeedback && submitFeedback.emailSent && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 flex items-start gap-2.5">
          <MailCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div className="font-medium">{submitFeedback.text}</div>
        </div>
      )}

      {submitError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>{submitError}</div>
        </div>
      )}

      {showNewForm && (
        <form
          onSubmit={handleSubmitTicket}
          className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3.5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                {t('support_subject_label')}
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Cannot book an appointment / Login problem..."
                className="w-full h-10 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                {t('support_contact_email_label')}
              </label>
              <input
                type="email"
                value={replyEmail}
                onChange={(e) => setReplyEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-10 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                {t('support_contact_phone_label')}
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+7 701 555 0101"
                className="w-full h-10 px-3 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                {t('support_page_label')}
              </label>
              <input
                type="text"
                readOnly
                value={t(`nav_${activeModule}`)}
                className="w-full h-10 px-3 text-xs bg-zinc-100 border border-zinc-200 rounded-lg text-zinc-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              {t('support_issue_label')} *
            </label>
            <textarea
              required
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 rounded-lg"
            >
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              <span>{submitting ? t('support_sending_btn') : t('support_submit_btn')}</span>
            </button>
          </div>
        </form>
      )}

      {/* Tabs: My Support Requests vs MEDRADAR Support Team Console */}
      <div className="inline-flex items-center p-1 bg-zinc-100 border border-zinc-200 rounded-xl">
        <button
          type="button"
          onClick={() => setTab('mine')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            tab === 'mine' ? 'bg-zinc-950 text-white' : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          {t('support_my_tab')} ({myTickets.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('team')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            tab === 'team' ? 'bg-emerald-600 text-white' : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          {t('support_team_tab')}
        </button>
      </div>

      {tab === 'mine' ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          {!user ? (
            <div className="py-8 text-center space-y-3">
              <Lock className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="text-xs text-zinc-600 max-w-md mx-auto">{t('support_signin_required')}</p>
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('auth_btn_signin')}</span>
              </button>
            </div>
          ) : loadingTickets ? (
            <div className="py-8 text-center text-xs text-zinc-500">Loading...</div>
          ) : myTickets.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">{t('support_empty_mine')}</div>
          ) : (
            <div className="divide-y divide-zinc-200">
              {myTickets.map((tk) => (
                <div key={tk.id} className="py-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-zinc-950">
                        {tk.ticketNumber}
                      </span>
                      <span className="text-sm font-semibold text-zinc-950">{tk.subject}</span>
                      {renderStatusBadge(tk.status)}
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${
                        tk.emailDelivery.sent
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}
                    >
                      {tk.emailDelivery.sent
                        ? t('support_email_sent_badge')
                        : t('support_email_not_sent_badge')}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-700 leading-relaxed">{tk.message}</p>
                  <div className="text-[11px] text-zinc-500 font-mono flex flex-wrap gap-3">
                    <span>{tk.createdAt.slice(0, 16).replace('T', ' ')}</span>
                    <span>· {tk.pageFeature}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
          {!isSupportTeam ? (
            <form onSubmit={handleUnlockTeam} className="max-w-md mx-auto py-6 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-zinc-950">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>{t('support_team_unlock_title')}</span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">{t('support_team_unlock_desc')}</p>
              {teamAuthError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900">
                  {teamAuthError}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  {t('support_team_passcode_label')}
                </label>
                <input
                  type="password"
                  value={teamPasscode}
                  onChange={(e) => setTeamPasscode(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg"
              >
                {t('support_team_unlock_btn')}
              </button>
            </form>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-200">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['All', 'New', 'In Progress', 'Resolved'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        statusFilter === st
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
                <span className="text-xs font-mono text-zinc-500">
                  {filteredTeamTickets.length} tickets
                </span>
              </div>

              {filteredTeamTickets.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">No tickets in this view.</div>
              ) : (
                <div className="divide-y divide-zinc-200">
                  {filteredTeamTickets.map((tk) => (
                    <div key={tk.id} className="py-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-zinc-950">
                            {tk.ticketNumber}
                          </span>
                          <span className="text-sm font-semibold text-zinc-950">{tk.subject}</span>
                          {renderStatusBadge(tk.status)}
                        </div>
                        <select
                          aria-label={`Status for ${tk.ticketNumber}`}
                          value={tk.status}
                          onChange={(e) =>
                            handleChangeStatus(tk.id, e.target.value as SupportTicketStatus)
                          }
                          className="h-8 px-2.5 text-xs font-medium bg-zinc-50 border border-zinc-200 rounded-lg"
                        >
                          <option value="New">{t('support_status_new')}</option>
                          <option value="In Progress">{t('support_status_in_progress')}</option>
                          <option value="Resolved">{t('support_status_resolved')}</option>
                        </select>
                      </div>
                      <p className="text-xs text-zinc-700 leading-relaxed">{tk.message}</p>
                      <div className="text-[11px] text-zinc-500 flex flex-wrap gap-3">
                        <span>{tk.submittedByName}</span>
                        {tk.phoneNumber && <span className="font-mono">· {tk.phoneNumber}</span>}
                        {tk.replyEmail && <span className="font-mono">· {tk.replyEmail}</span>}
                        <span>· {tk.pageFeature}</span>
                        <span className="font-mono">
                          · {tk.createdAt.slice(0, 16).replace('T', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Backend Configuration Readiness Card */}
      {configStatus && (
        <div className="bg-zinc-950 text-white border border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="text-sm font-bold flex items-center gap-2 text-emerald-400">
            <Mail className="w-4 h-4" />
            <span>{t('support_config_card_title')}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-lg space-y-1.5">
              <div className="font-semibold text-white flex items-center justify-between">
                <span>Official Support Email (SMTP)</span>
                <span
                  className={`font-mono text-[11px] ${
                    configStatus.emailConfigured ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {configStatus.emailConfigured ? 'READY' : 'SETUP REQUIRED'}
                </span>
              </div>
              <div className="font-mono text-[11px] text-zinc-400">
                SUPPORT_EMAIL={configStatus.supportEmailPreview}
              </div>
              {!configStatus.emailConfigured && (
                <div className="text-[11px] text-amber-300">
                  Missing server env vars: {configStatus.missingEmailVars.join(', ')}
                </div>
              )}
            </div>

            <div className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-lg space-y-1.5">
              <div className="font-semibold text-white flex items-center justify-between">
                <span>Real SMS OTP Service</span>
                <span
                  className={`font-mono text-[11px] ${
                    configStatus.smsConfigured ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {configStatus.smsConfigured ? configStatus.smsProvider.toUpperCase() : 'SETUP REQUIRED'}
                </span>
              </div>
              {!configStatus.smsConfigured && (
                <div className="text-[11px] text-amber-300">
                  Missing server env vars: {configStatus.missingSmsVars.join(', ')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
