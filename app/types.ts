export interface Profile {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
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

export interface ProfileData {
  profile: Profile;
  notes: Note[];
  image?: string;
  characterName?: string;
}

