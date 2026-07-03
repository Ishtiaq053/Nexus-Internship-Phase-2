import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, Plus, CheckCircle, XCircle, Trash2,
  User, AlertCircle, ChevronRight, Loader2
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { Meeting, MeetingStatus } from '../../types';
import {
  apiGetMeetings,
  apiCreateMeeting,
  apiRespondToMeeting,
  apiCancelMeeting,
  ApiError,
} from '../../lib/api';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_VARIANTS: Record<MeetingStatus, 'primary' | 'success' | 'error' | 'gray'> = {
  pending:   'primary',
  accepted:  'success',
  rejected:  'error',
  cancelled: 'gray',
};

// ─── Schedule Meeting Modal ───────────────────────────────────────────────────

interface ScheduleModalProps {
  onClose: () => void;
  onScheduled: (meeting: Meeting) => void;
  currentUserId: string;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({ onClose, onScheduled, currentUserId }) => {
  const [inviteeId, setInviteeId] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startHour, setStartHour] = useState('09:00');
  const [endHour, setEndHour] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!date) { setError('Please select a date.'); return; }

    const startTime = new Date(`${date}T${startHour}:00`).toISOString();
    const endTime = new Date(`${date}T${endHour}:00`).toISOString();

    if (new Date(endTime) <= new Date(startTime)) {
      setError('End time must be after start time.'); return;
    }

    setLoading(true);
    try {
      const { meeting } = await apiCreateMeeting({ inviteeId, title, startTime, endTime, notes });
      // Normalize _id → id for frontend consistency
      const normalized: Meeting = { ...meeting, id: meeting._id || meeting.id };
      onScheduled(normalized);
      toast.success('Meeting request sent!');
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to create meeting.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Generate hour options
  const hours = Array.from({ length: 24 }, (_, i) => {
    const h = String(i).padStart(2, '0');
    return `${h}:00`;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Calendar size={20} className="text-primary-600" />
            Schedule a Meeting
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <XCircle size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-300 text-red-700 text-sm px-4 py-3 rounded-lg">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Input
            label="Invitee User ID"
            placeholder="Paste the other user's MongoDB ID"
            value={inviteeId}
            onChange={(e) => setInviteeId(e.target.value)}
            required
            fullWidth
            startAdornment={<User size={16} />}
          />

          <Input
            label="Meeting Title"
            placeholder="e.g. Pitch Discussion, Q&A Session"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            fullWidth
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <select
                value={startHour}
                onChange={(e) => setStartHour(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {hours.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <select
                value={endHour}
                onChange={(e) => setEndHour(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {hours.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Agenda, topics to discuss…"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" fullWidth isLoading={loading} leftIcon={<Plus size={16} />}>
              Send Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Meeting Card ─────────────────────────────────────────────────────────────

interface MeetingCardProps {
  meeting: Meeting;
  currentUserId: string;
  onRespond: (id: string, response: 'accepted' | 'rejected') => void;
  onCancel: (id: string) => void;
  respondingId: string | null;
  cancellingId: string | null;
}

const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting, currentUserId, onRespond, onCancel, respondingId, cancellingId,
}) => {
  const isOrganizer = meeting.organizer?.id === currentUserId;
  const other = isOrganizer ? meeting.invitee : meeting.organizer;
  const isResponding = respondingId === meeting.id;
  const isCancelling = cancellingId === meeting.id;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
      {/* Avatar */}
      <Avatar src={other?.avatarUrl} alt={other?.name || 'User'} size="md" className="shrink-0" />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{meeting.title}</h3>
          <Badge variant={STATUS_VARIANTS[meeting.status]} size="sm">
            {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
          </Badge>
          {isOrganizer && (
            <Badge variant="gray" size="sm">You organised</Badge>
          )}
        </div>

        <p className="text-sm text-gray-600 mt-0.5">
          with <span className="font-medium">{other?.name || 'Unknown'}</span>
          {' '}({other?.role})
        </p>

        <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {formatDate(meeting.startTime)}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}
          </span>
        </div>

        {meeting.notes && (
          <p className="mt-1.5 text-xs text-gray-500 italic line-clamp-1">"{meeting.notes}"</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Invitee can accept/reject pending meetings */}
        {!isOrganizer && meeting.status === 'pending' && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRespond(meeting.id, 'rejected')}
              isLoading={isResponding}
              className="text-red-600 border-red-300 hover:bg-red-50"
              leftIcon={<XCircle size={14} />}
            >
              Decline
            </Button>
            <Button
              size="sm"
              onClick={() => onRespond(meeting.id, 'accepted')}
              isLoading={isResponding}
              leftIcon={<CheckCircle size={14} />}
            >
              Accept
            </Button>
          </>
        )}

        {/* Organizer can cancel non-cancelled meetings */}
        {isOrganizer && meeting.status !== 'cancelled' && meeting.status !== 'rejected' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onCancel(meeting.id)}
            isLoading={isCancelling}
            className="text-gray-500 hover:text-red-600"
            leftIcon={<Trash2 size={14} />}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};

// ─── MeetingsPage ─────────────────────────────────────────────────────────────

const TABS: { label: string; value: MeetingStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Past / Closed', value: 'rejected' },
];

export const MeetingsPage: React.FC = () => {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<MeetingStatus | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const { meetings: raw } = await apiGetMeetings();
      // Normalise _id → id (Mongoose returns _id, we want id for consistency)
      const normalised: Meeting[] = raw.map((m: any) => ({
        ...m,
        id: m._id || m.id,
        organizer: { ...m.organizer, id: m.organizer?._id || m.organizer?.id },
        invitee:   { ...m.invitee,   id: m.invitee?._id   || m.invitee?.id   },
      }));
      setMeetings(normalised);
    } catch {
      toast.error('Could not load meetings. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMeetings(); }, [loadMeetings]);

  const handleRespond = async (id: string, response: 'accepted' | 'rejected') => {
    setRespondingId(id);
    try {
      const { meeting: raw } = await apiRespondToMeeting(id, response);
      const updated: Meeting = {
        ...raw,
        id: raw._id || raw.id,
        organizer: { ...raw.organizer, id: raw.organizer?._id || raw.organizer?.id },
        invitee:   { ...raw.invitee,   id: raw.invitee?._id   || raw.invitee?.id   },
      };
      setMeetings(prev => prev.map(m => m.id === id ? updated : m));
      toast.success(response === 'accepted' ? 'Meeting accepted!' : 'Meeting declined.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to respond.';
      toast.error(msg);
    } finally {
      setRespondingId(null);
    }
  };

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await apiCancelMeeting(id);
      setMeetings(prev => prev.map(m => m.id === id ? { ...m, status: 'cancelled' } : m));
      toast.success('Meeting cancelled.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to cancel.';
      toast.error(msg);
    } finally {
      setCancellingId(null);
    }
  };

  const handleScheduled = (meeting: Meeting) => {
    setMeetings(prev => [meeting, ...prev]);
  };

  // Filter by tab
  const filtered = tab === 'all'
    ? meetings
    : tab === 'rejected'
      ? meetings.filter(m => m.status === 'rejected' || m.status === 'cancelled')
      : meetings.filter(m => m.status === tab);

  // Count upcoming (accepted + in the future)
  const upcomingCount = meetings.filter(
    m => m.status === 'accepted' && new Date(m.startTime) > new Date()
  ).length;

  const pendingCount = meetings.filter(m => m.status === 'pending').length;

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
          <p className="text-gray-600">Schedule and manage your investor / startup meetings</p>
        </div>
        <Button leftIcon={<Plus size={18} />} onClick={() => setShowModal(true)}>
          Schedule Meeting
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: meetings.length, color: 'bg-gray-50 border-gray-100 text-gray-700' },
          { label: 'Pending', value: pendingCount, color: 'bg-primary-50 border-primary-100 text-primary-700' },
          { label: 'Upcoming', value: upcomingCount, color: 'bg-green-50 border-green-100 text-green-700' },
          { label: 'Cancelled', value: meetings.filter(m => m.status === 'cancelled').length, color: 'bg-red-50 border-red-100 text-red-700' },
        ].map(stat => (
          <Card key={stat.label} className={`border ${stat.color}`}>
            <CardBody>
              <p className="text-xs font-medium uppercase tracking-wider opacity-70">{stat.label}</p>
              <p className="text-3xl font-bold mt-1">{stat.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === t.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
            {t.value === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 bg-primary-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Meeting list */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-medium text-gray-900">
            {tab === 'all' ? 'All Meetings' : `${TABS.find(t => t.value === tab)?.label} Meetings`}
            <span className="ml-2 text-sm text-gray-400 font-normal">({filtered.length})</span>
          </h2>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
              <Loader2 size={20} className="animate-spin" />
              <span>Loading meetings…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <Calendar size={28} className="text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">No meetings found</p>
              <p className="text-sm text-gray-500 mt-1">
                {tab === 'all'
                  ? 'Click "Schedule Meeting" to request your first meeting.'
                  : `No ${tab} meetings.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(meeting => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  currentUserId={user.id}
                  onRespond={handleRespond}
                  onCancel={handleCancel}
                  respondingId={respondingId}
                  cancellingId={cancellingId}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Schedule modal */}
      {showModal && (
        <ScheduleModal
          onClose={() => setShowModal(false)}
          onScheduled={handleScheduled}
          currentUserId={user.id}
        />
      )}
    </div>
  );
};
