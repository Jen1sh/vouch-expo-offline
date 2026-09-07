import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

import { db } from "@/src/db/client";
import { ensureMigrated } from "@/src/db/migrate";
import { getCatalogProfileById } from "@/src/db/queries/catalog.queries";
import { seedChatIfEmpty } from "@/src/db/queries/chat.queries";
import { getMatch, setMatchRead } from "@/src/db/queries/matches.queries";
import { listMessagesPage } from "@/src/db/queries/messages.queries";
import {
  appendOlder,
  mergeNewest,
  withoutMessage,
  type ThreadMessage,
} from "@/src/features/chat/model/thread";
import { refreshMatches } from "@/src/features/chat/store/matches";
import { noteThreadChanged, useThreadRevision } from "@/src/features/chat/store/thread-revision";
import { useTyping } from "@/src/features/chat/store/typing";

export const THREAD_PAGE_SIZE = 30;

export type ThreadStatus = "loading" | "ready" | "error";

export type ThreadPartner = { profileId: string; name: string; photoUri: string } | null;

/**
 * Drives an inverted, newest-first thread (REQUIREMENTS §3.6). The first page
 * comes from `listMessagesPage` (newest-first, keyset), and scrolling up past
 * the top (`onEndReached` on an inverted FlashList) appends an OLDER page to
 * the back of the array. Two triggers reconcile the list live:
 * - the thread-revision store (realtime incoming + our own send) re-fetches the
 *   newest page and merges new arrivals to the FRONT;
 * - tab focus marks the thread read and refreshes the matches list.
 * A keyset epoch guard discards responses that belong to a stale fetch.
 */
export function useThread(matchId: string) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [status, setStatus] = useState<ThreadStatus>("loading");
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [tailError, setTailError] = useState(false);
  const [partner, setPartner] = useState<ThreadPartner>(null);

  const revision = useThreadRevision(matchId);
  const partnerTyping = useTyping(matchId);
  const epochRef = useRef(0);
  const loadedOnceRef = useRef(false);

  // Fetch + merge the newest page on mount and on every thread revision bump.
  useEffect(() => {
    const epoch = ++epochRef.current;
    let active = true;
    (async () => {
      try {
        await ensureMigrated();
        await seedChatIfEmpty();
        const page = await listMessagesPage(matchId, { limit: THREAD_PAGE_SIZE });
        if (!active || epochRef.current !== epoch) {
          return;
        }
        const rows = page.items.map(toThreadMessage);
        setMessages((current) =>
          loadedOnceRef.current ? mergeNewest(current, rows) : rows
        );
        loadedOnceRef.current = true;
        setHasMore(page.hasMore);
        setStatus("ready");
      } catch (error) {
        if (!active || epochRef.current !== epoch) {
          return;
        }
        setStatus("error");
        console.warn("[thread] failed to load newest page", error);
      }
    })();
    return () => {
      active = false;
    };
  }, [matchId, revision]);

  // Partner identity once per thread mount.
  useEffect(() => {
    let active = true;
    ensureMigrated()
      .then(async () => {
        await seedChatIfEmpty();
        const match = await getMatch(db, matchId);
        if (!active || !match) {
          return;
        }
        const catalog = await getCatalogProfileById(match.profileId);
        if (active && catalog) {
          setPartner({
            profileId: match.profileId,
            name: `${catalog.firstName} ${catalog.lastName}`,
            photoUri: catalog.photoUri,
          });
        }
      })
      .catch((error) => console.warn("[thread] partner lookup failed", error));
    return () => {
      active = false;
    };
  }, [matchId]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore || messages.length === 0) {
      return;
    }
    const oldest = messages[messages.length - 1];
    const before = { createdAt: new Date(oldest.createdAt), id: oldest.id };
    setLoadingOlder(true);
    setTailError(false);
    try {
      const page = await listMessagesPage(matchId, { limit: THREAD_PAGE_SIZE, before });
      setMessages((current) => appendOlder(current, page.items.map(toThreadMessage)));
      setHasMore(page.hasMore);
    } catch (error) {
      setTailError(true);
      console.warn("[thread] older page failed", error);
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMore, loadingOlder, messages, matchId]);

  // Opening the thread (re)focuses the read watermark + refreshes the list.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      ensureMigrated()
        .then(() => setMatchRead(db, matchId, new Date()))
        .then(() => {
          if (active) {
            void refreshMatches();
          }
        })
        .catch((error) => console.warn("[thread] mark-read failed", error));
      return () => {
        active = false;
      };
    }, [matchId])
  );

  const reload = useCallback(() => {
    noteThreadChanged(matchId);
  }, [matchId]);

  /** Drop a locally-deleted message from the loaded pages (after `deleteMessage`). */
  const removeMessage = useCallback((messageId: string) => {
    setMessages((current) => withoutMessage(current, messageId));
  }, []);

  return {
    messages,
    status,
    hasMore,
    loadingOlder,
    tailError,
    partner,
    partnerTyping,
    onEndReached: loadOlder,
    retry: reload,
    removeMessage,
  };
}

function toThreadMessage(row: {
  id: string;
  matchId: string;
  senderId: string;
  body: string;
  status: ThreadMessage["status"];
  outboxItemId: string | null;
  createdAt: Date;
}): ThreadMessage {
  return {
    id: row.id,
    matchId: row.matchId,
    senderId: row.senderId,
    body: row.body,
    status: row.status,
    outboxItemId: row.outboxItemId,
    createdAt: row.createdAt.getTime(),
  };
}