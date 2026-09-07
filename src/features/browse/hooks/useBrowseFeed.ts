import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

import { ensureMigrated } from "@/src/db/migrate";
import {
  listCatalogPage,
  seedCatalogIfEmpty,
  type CatalogBrowseItem,
} from "@/src/db/queries/catalog.queries";
import { listAllSwipes } from "@/src/db/queries/swipes.queries";
import type { BrowseFilters } from "@/src/features/browse/model/browseFilters";
import { emptyFeed, mergePage, type FeedState } from "@/src/features/browse/model/feed";
import { hydrateFromSwipes } from "@/src/features/browse/store/user-swipes";

export const BROWSE_PAGE_SIZE = 15;

export type BrowseFeedStatus = "loading" | "ready" | "error";

/**
 * Drives the Browse list's SQLite-backed, paginated feed (REQUIREMENTS §3.4).
 * Every page is a waterfall query through `listCatalogPage` (LIMIT/OFFSET in
 * the database — not an in-memory slice), pages accumulate in `mergePage`, and
 * the per-row like mirror is re-hydrated from `swipes` whenever the tab
 * regains focus so likes made elsewhere (Discover) show up without a full
 * re-query. An epoch guard discards responses that belong to a stale filter.
 */
export function useBrowseFeed(filters: BrowseFilters) {
  const [feed, setFeed] = useState<FeedState<CatalogBrowseItem>>(emptyFeed);
  const [status, setStatus] = useState<BrowseFeedStatus>("loading");
  const [tailError, setTailError] = useState(false);
  const fetchingRef = useRef(false);
  const epochRef = useRef(0);

  const loadFirstPage = useCallback(async () => {
    const epoch = ++epochRef.current;
    fetchingRef.current = true;
    setStatus("loading");
    setTailError(false);
    setFeed(emptyFeed<CatalogBrowseItem>());
    try {
      await ensureMigrated();
      await seedCatalogIfEmpty();
      const page = await listCatalogPage({
        filters,
        limit: BROWSE_PAGE_SIZE,
        offset: 0,
      });
      if (epochRef.current !== epoch) {
        return;
      }
      setFeed(mergePage(emptyFeed<CatalogBrowseItem>(), page));
      setStatus("ready");
    } catch (error) {
      if (epochRef.current !== epoch) {
        return;
      }
      setStatus("error");
      console.warn("[browse] first page failed", error);
    } finally {
      fetchingRef.current = false;
    }
  }, [filters]);

  const loadMore = useCallback(async () => {
    if (fetchingRef.current || !feed.hasMore) {
      return;
    }
    const epoch = epochRef.current;
    const offset = feed.items.length;
    fetchingRef.current = true;
    setTailError(false);
    try {
      await ensureMigrated();
      const page = await listCatalogPage({
        filters,
        limit: BROWSE_PAGE_SIZE,
        offset,
      });
      if (epochRef.current !== epoch) {
        return;
      }
      setFeed((current) => mergePage(current, page));
    } catch (error) {
      if (epochRef.current !== epoch) {
        return;
      }
      setTailError(true);
      console.warn("[browse] tail page failed", error);
    } finally {
      fetchingRef.current = false;
    }
  }, [filters, feed.hasMore, feed.items.length]);

  const retryTail = useCallback(() => {
    void loadMore();
  }, [loadMore]);

  // First page on mount and whenever the filters change (resets to the top).
  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  // Re-hydrate the per-row like mirror from sqlite whenever the tab regains
  // focus — likes performed in Discover re-appear without re-fetching the list.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      ensureMigrated()
        .then(() => listAllSwipes())
        .then((rows) => {
          if (active) {
            hydrateFromSwipes(rows);
          }
        })
        .catch((error) => {
          if (active) {
            console.warn("[browse] failed to refresh like state", error);
          }
        });
      return () => {
        active = false;
      };
    }, [])
  );

  return {
    items: feed.items,
    hasMore: feed.hasMore,
    status,
    tailError,
    retry: loadFirstPage,
    retryTail,
    onEndReached: loadMore,
  };
}