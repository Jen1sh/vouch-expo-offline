/**
 * Pure feed-pagination helpers for the Browse list (REQUIREMENTS §3.4 —
 * "apply pagination from the sqlite data"). `mergePage` appends a fetched
 * page to the accumulated list, de-duplicating by id so an out-of-order or
 * stale page can never double a row. Kept deliberately framework-free so the
 * paging behavior is unit-testable without a database.
 */

export type PageResult<T> = {
  items: T[];
  hasMore: boolean;
};

export type FeedState<T> = {
  items: T[];
  hasMore: boolean;
};

export function emptyFeed<T>(): FeedState<T> {
  return { items: [], hasMore: false };
}

export function mergePage<T extends { id: string }>(
  state: FeedState<T>,
  page: PageResult<T>
): FeedState<T> {
  const seen = new Set(state.items.map((item) => item.id));
  const items = [...state.items];
  for (const item of page.items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      items.push(item);
    }
  }
  return { items, hasMore: page.hasMore };
}