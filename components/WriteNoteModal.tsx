 "use client";

import type { RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";

type WriteNoteModalProps = {
  isOpen: boolean;
  isMobile: boolean;
  noteText: string;
  setNoteText: (value: string) => void;
  noteSaving: boolean;
  noteEmotionType: "anger" | "feelings" | "appreciation";
  setNoteEmotionType: (value: "anger" | "feelings" | "appreciation") => void;
  setShowWriteModal: (value: boolean) => void;
  handleSaveNote: () => void;
  noteInputRef: RefObject<HTMLTextAreaElement>;
  resizeNoteInput: () => void;
  sheetDragStartY: number | null;
  setSheetDragStartY: (value: number | null) => void;
};

const WriteNoteModal = ({
  isOpen,
  isMobile,
  noteText,
  setNoteText,
  noteSaving,
  noteEmotionType,
  setNoteEmotionType,
  setShowWriteModal,
  handleSaveNote,
  noteInputRef,
  resizeNoteInput,
  sheetDragStartY,
  setSheetDragStartY,
}: WriteNoteModalProps) => (
  <>
    {/* Write Modal - Desktop */}
    <AnimatePresence>
      {isOpen && !isMobile && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowWriteModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white/95 backdrop-blur-md rounded-xl p-6 w-full max-w-md space-y-4 relative shadow-2xl border border-pink-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">Just say it dont Keep it</h3>
              <button
                onClick={() => setShowWriteModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            <div className="space-y-2 mb-4">
              <label className="text-sm text-gray-600">Emotion</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "anger", label: "Anger" },
                  { value: "feelings", label: "Feelings" },
                  { value: "appreciation", label: "Appreciation" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNoteEmotionType(opt.value as "anger" | "feelings" | "appreciation")}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      noteEmotionType === opt.value
                        ? "bg-pink-50 border-pink-200 text-gray-800"
                        : "bg-white/80 border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              ref={noteInputRef}
              value={noteText}
              onChange={(e) => {
                setNoteText(e.target.value);
                resizeNoteInput();
              }}
              placeholder="Write your note here..."
              className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 min-h-32 resize-none placeholder:text-gray-400 bg-white/80 text-gray-800 overflow-y-auto"
            />
            <button
              onClick={handleSaveNote}
              disabled={!noteText.trim() || noteSaving}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-all ${
                noteText.trim() && !noteSaving
                  ? "bg-gradient-to-r from-pink-400 to-pink-500 text-white hover:from-pink-500 hover:to-pink-600 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {noteSaving ? "Saving..." : "Save"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Write Bottom Sheet - Mobile */}
    <AnimatePresence>
      {isOpen && isMobile && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50"
        >
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowWriteModal(false)}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md rounded-t-2xl max-h-[80vh] flex flex-col overflow-hidden"
            onTouchStart={(e) => setSheetDragStartY(e.touches[0].clientY)}
            onTouchMove={(e) => {
              if (sheetDragStartY && e.touches[0].clientY - sheetDragStartY > 80) {
                setShowWriteModal(false);
                setSheetDragStartY(null);
              }
            }}
            onTouchEnd={() => setSheetDragStartY(null)}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Just say it dont Keep it</h3>
              <button
                onClick={() => setShowWriteModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-hidden">
              <div className="space-y-2">
                <label className="text-sm text-gray-600">Emotion</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "anger", label: "Anger" },
                    { value: "feelings", label: "Feelings" },
                    { value: "appreciation", label: "Appreciation" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNoteEmotionType(opt.value as "anger" | "feelings" | "appreciation")}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        noteEmotionType === opt.value
                          ? "bg-pink-50 border-pink-200 text-gray-800"
                          : "bg-white/80 border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                ref={noteInputRef}
                value={noteText}
                onChange={(e) => {
                  setNoteText(e.target.value);
                  resizeNoteInput();
                }}
                placeholder="Write your note here..."
                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 min-h-32 resize-none placeholder:text-gray-400 bg-white/80 text-gray-800 overflow-y-auto max-h-[50vh]"
              />
              <button
                onClick={handleSaveNote}
                disabled={!noteText.trim() || noteSaving}
                className={`w-full py-2 px-4 rounded-lg font-medium transition-all ${
                  noteText.trim() && !noteSaving
                    ? "bg-gradient-to-r from-pink-400 to-pink-500 text-white hover:from-pink-500 hover:to-pink-600 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {noteSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  </>
);

export default WriteNoteModal;
