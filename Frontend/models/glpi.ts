export type GlpiOpenTicketItem = {
  id: number;
  title: string;
};

export type GlpiOpenTicketsResponse = {
  items: GlpiOpenTicketItem[];
  total: number;
};

export type GlpiTicketQueueItem = {
  id: number;
  title: string;
  status?: number | string;
  status_label?: string;
  category?: string;
  requester?: string;
  assigned_to?: string;
  created_at?: string;
  updated_at?: string;
  priority?: number | string;
};

export type GlpiTicketQueueResponse = {
  items: GlpiTicketQueueItem[];
  total: number;
};

export type GlpiTicketAlertItem = GlpiTicketQueueItem & {
  age_days?: number;
  stale_days?: number;
};

export type GlpiTicketAlertsResponse = {
  enabled: boolean;
  thresholds: {
    unassigned_days: number;
    stale_days: number;
  };
  unassigned: GlpiTicketAlertItem[];
  stale: GlpiTicketAlertItem[];
  total_unassigned: number;
  total_stale: number;
};

export type GlpiTicketDetail = {
  id: number;
  title: string;
  status?: number | string;
  status_label?: string;
  category?: string;
  content?: string;
  requester?: string;
  assigned_to?: string;
  created_at?: string;
  updated_at?: string;
  priority?: number | string;
  urgency?: number | string;
  impact?: number | string;
};

export type GlpiTicketFollowup = {
  id: number | null;
  author?: string | null;
  created_at?: string | null;
  content: string;
};

export type GlpiTicketFollowupsResponse = {
  items: GlpiTicketFollowup[];
  total: number;
};

export type GlpiTicketAttachment = {
  id: number | null;
  document_id?: number | null;
  name?: string | null;
  filename?: string | null;
};

export type GlpiTicketAttachmentsResponse = {
  items: GlpiTicketAttachment[];
  total: number;
};
