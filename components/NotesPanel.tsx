 "use client";

import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Note } from "@/app/types";

type NotesPanelProps = {
  isMobile: boolean;
  isGuestMode: boolean;
  notes: Note[];
  notesLoading: boolean;
  noteSaving: boolean;
  userId?: string;
  showNotesSheet: boolean;
  setShowNotesSheet: (value: boolean) => void;
  sheetDragStartY: number | null;
  setSheetDragStartY: (value: number | null) => void;
  handleDeleteNote: (id: string, authorId: string) => void;
  formatNoteDate: (timestamp?: number) => string;
  getNoteTagClasses: (emotionType?: Note["emotionType"]) => string;
  getNoteHeaderText: (emotionType?: Note["emotionType"]) => string;
};

const NotesPanel = ({
  isMobile,
  isGuestMode,
  notes,
  notesLoading,
  noteSaving,
  userId,
  showNotesSheet,
  setShowNotesSheet,
  sheetDragStartY,
  setSheetDragStartY,
  handleDeleteNote,
  formatNoteDate,
  getNoteTagClasses,
  getNoteHeaderText,
}: NotesPanelProps) => (
  <>
    {/* Sticky Notes - Desktop Only */}
    {!isMobile && (
      <div className="fixed right-4 top-4 bottom-4 w-64 flex flex-col items-end gap-3 overflow-y-auto overscroll-contain pt-20 pb-4 pr-1 pointer-events-none z-20 [scrollbar-width:thin] [scrollbar-color:#d1d5db_transparent]">
        <AnimatePresence>
          {notesLoading
            ? [...Array(4)].map((_, i) => (
                <div
                  key={`note-skel-desktop-${i}`}
                  className="w-56 rounded-2xl border border-gray-100 bg-white/70 p-4 animate-pulse pointer-events-auto"
                >
                  <div className="h-3 w-20 bg-gray-200 rounded" />
                  <div className="h-3 w-full bg-gray-200 rounded mt-3" />
                  <div className="h-3 w-5/6 bg-gray-200 rounded mt-2" />
                </div>
              ))
            : notes.map((note) => {
                const canDelete = isGuestMode || note.authorId === userId;
                return (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, x: 50, scale: 0.8 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 50, scale: 0.8 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="w-56 rounded-2xl shadow-sm p-4 relative pointer-events-auto border bg-white/70 backdrop-blur-sm border-gray-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className={`text-[11px] px-2 py-0.5 rounded-full ${getNoteTagClasses(note.emotionType)}`}>
                        {getNoteHeaderText(note.emotionType)}
                      </div>
                      <div className="relative group">
                        <button
                          onClick={() => handleDeleteNote(note.id, note.authorId)}
                          disabled={noteSaving || !canDelete}
                          className={`transition-colors ${
                            noteSaving || !canDelete
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-gray-500 hover:text-gray-700"
                          }`}
                          aria-label="Delete note"
                          title={canDelete ? "Delete note" : undefined}
                        >
                          {noteSaving && canDelete ? (
                            <span className="h-4 w-4 inline-block rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l1 14h10l1-14" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14 11v6" />
                            </svg>
                          )}
                        </button>
                        {!canDelete && (
                          <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                            Can only be deleted by the writer
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-800 mt-2 break-words">{note.text}</p>
                    <div className="mt-2 text-xs text-gray-500 text-right">
                      {formatNoteDate(note.createdAt)}
                    </div>
                  </motion.div>
                );
              })}
        </AnimatePresence>
      </div>
    )}

    {/* Notes CTA - Mobile Only */}
    {isMobile && notes.length > 0 && (
      <button
        onClick={() => setShowNotesSheet(true)}
        className="fixed right-4 bottom-6 z-40 px-4 py-3 rounded-full bg-white/90 backdrop-blur-sm border border-gray-200 shadow-md text-sm font-medium text-gray-700"
      >
        Notes
      </button>
    )}

    {/* Notes Bottom Sheet - Mobile Only */}
    <AnimatePresence>
      {isMobile && showNotesSheet && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50"
        >
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowNotesSheet(false)}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md rounded-t-2xl p-4 max-h-[80vh] flex flex-col overflow-hidden"
            onTouchStart={(e) => setSheetDragStartY(e.touches[0].clientY)}
            onTouchMove={(e) => {
              if (sheetDragStartY && e.touches[0].clientY - sheetDragStartY > 80) {
                setShowNotesSheet(false);
                setSheetDragStartY(null);
              }
            }}
            onTouchEnd={() => setSheetDragStartY(null)}
          >
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-lg font-semibold text-gray-800">Notes</h3>
              <button
                onClick={() => setShowNotesSheet(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto">
              {notesLoading ? (
                [...Array(4)].map((_, i) => (
                  <div
                    key={`note-skel-mobile-${i}`}
                    className="rounded-2xl border border-gray-100 bg-white/70 p-4 animate-pulse"
                  >
                    <div className="h-3 w-20 bg-gray-200 rounded" />
                    <div className="h-3 w-full bg-gray-200 rounded mt-3" />
                    <div className="h-3 w-5/6 bg-gray-200 rounded mt-2" />
                  </div>
                ))
              ) : (
                notes.map((note) => {
                  const canDelete = isGuestMode || note.authorId === userId;
                  return (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="rounded-2xl shadow-sm p-4 relative border bg-white/70 backdrop-blur-sm border-gray-200"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className={`text-[11px] px-2 py-0.5 rounded-full ${getNoteTagClasses(note.emotionType)}`}>
                          {getNoteHeaderText(note.emotionType)}
                        </div>
                        <div className="relative group">
                          <button
                            onClick={() => handleDeleteNote(note.id, note.authorId)}
                            disabled={noteSaving || !canDelete}
                            className={`transition-colors ${
                              noteSaving || !canDelete
                                ? "text-gray-300 cursor-not-allowed"
                                : "text-gray-500 hover:text-gray-700"
                            }`}
                            aria-label="Delete note"
                            title={canDelete ? "Delete note" : undefined}
                          >
                            {noteSaving && canDelete ? (
                              <span className="h-4 w-4 inline-block rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l1 14h10l1-14" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14 11v6" />
                              </svg>
                            )}
                          </button>
                          {!canDelete && (
                            <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                              Can only be deleted by the writer
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-800 mt-2 break-words">{note.text}</p>
                      <div className="mt-2 text-xs text-gray-500 text-right">
                        {formatNoteDate(note.createdAt)}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  </>
);

export default memo(NotesPanel);
