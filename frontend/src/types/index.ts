export type UUID = string;

export type Category = {
  id: UUID;
  name: string;
  slug: string;
};

export type Tag = {
  id: UUID;
  name: string;
  slug: string;
};

export type ArticleLink = {
  id: UUID;
  title: string;
  slug: string;
};

export type Article = {
  id: UUID;
  title: string;
  slug: string;
  content: string;
  excerpt?: string | null;
  category?: UUID | null;
  category_name?: string | null;
  author_name?: string | null;
  is_public?: boolean;
  is_featured?: boolean;
  status?: string;
  image?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
  tags?: UUID[];
  previous_post?: ArticleLink | null;
  next_post?: ArticleLink | null;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
  view_count?: number;
  read_time_minutes?: number;
  comment_count?: number;
};


export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};
