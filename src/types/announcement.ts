import type {
  Announcement,
  AnnouncementAudienceType,
  AnnouncementLink,
} from './database';

export type AnnouncementLinkDraft = {
  localKey: string;
  title: string;
  url: string;
};

export type AdminAnnouncementInput = {
  id?: string;
  title: string;
  message: string;
  audience_type: AnnouncementAudienceType;
  exam_id: string | null;
  subject_id: string | null;
  is_pinned: boolean;
  is_published: boolean;
  created_by: string | null;
  links: AnnouncementLinkDraft[];
};

export type AnnouncementFeedItem = Announcement & {
  audienceLabel: string;
  links: AnnouncementLink[];
};
