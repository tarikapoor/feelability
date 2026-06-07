export interface Profile {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  bio?: string;
  profileType?: "express" | "mirror";
  visibility: "public" | "private";
  createdAt: number;
  punchCount: number;
  hugCount: number;
  kissCount: number;
  notesCount: number;
  imageData?: string | null;
}

export interface Note {
  id: string;
  text: string;
  authorId: string;
  emotionType?: "anger" | "feelings" | "appreciation";
  createdAt?: number;
}

export interface Review {
  id: string;
  profileId: string;
  rating: number;
  reviewText: string;
  category?: "appreciate" | "need_to_work_on" | "just_saying";
  status?: "approved" | "pending" | "rejected";
  submissionId?: string | null;
  createdAt?: number;
}

export interface ProfileData {
  profile: Profile;
  notes: Note[];
  image?: string;
  characterName?: string;
}

