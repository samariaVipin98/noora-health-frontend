import React, { useEffect, useState, useRef } from 'react';
import { fetchLocations } from './services/ExternalAPIService';
import { generateDialogue, semanticSearch, saveNote, getNote, deleteNote } from './services/BackendAPIService';

export default function App() {
  const [locations, setLocations] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selectedChar, setSelectedChar] = useState(null);
  const [noteInput, setNoteInput] = useState("");
  
  // UI States
  const [loading, setLoading] = useState(true); // Keeps track of initial load
  const [error, setError] = useState(null);     // Prevents crashes

  // AI & Search States
  const [aiData, setAiData] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isScriptCollapsed, setIsScriptCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResultData, setSearchResultData] = useState(null); 
  const [notes, setNotes] = useState({});

  // Horizontal scroll refs for character carousels
  const scrollRefs = useRef({});

  // Speech synthesis state
  const [availableVoices, setAvailableVoices] = useState([]);
  const [currentSpokenIndex, setCurrentSpokenIndex] = useState(null);
  const [isGlobalMuted, setIsGlobalMuted] = useState(false);

  const scrollResidents = (locId, direction) => {
    const container = scrollRefs.current[locId];
    if (!container) return;
    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Load voices for Web Speech API
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const synth = window.speechSynthesis;

    const updateVoices = () => {
      const voices = synth.getVoices();
      if (voices && voices.length) {
        setAvailableVoices(voices);
      }
    };

    updateVoices();
    synth.addEventListener("voiceschanged", updateVoices);

    return () => {
      synth.removeEventListener("voiceschanged", updateVoices);
    };
  }, []);

  const stopSpeech = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setCurrentSpokenIndex(null);
  };

  const speakDialogue = (dialogueText) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (!dialogueText) return;

    const synth = window.speechSynthesis;

    // Stop any ongoing narration
    synth.cancel();

    const lines = dialogueText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (!lines.length) return;

    const voices =
      availableVoices.length > 0 ? availableVoices : synth.getVoices();

    if (!voices || !voices.length) return;

    // Prefer English voices when possible
    const primary =
      voices.find((v) => /en-?US/i.test(v.lang)) ||
      voices.find((v) => /en/i.test(v.lang)) ||
      voices[0];

    const secondary =
      voices.find((v) => v !== primary && /en/i.test(v.lang)) ||
      voices.find((v) => v !== primary) ||
      primary;

    lines.forEach((rawLine, index) => {
      let line = rawLine;
      let voiceForLine = primary;

      if (rawLine.startsWith("Rick:")) {
        line = rawLine.replace(/^Rick:\s*/, "");
        voiceForLine = primary;
      } else if (rawLine.startsWith("Morty:")) {
        line = rawLine.replace(/^Morty:\s*/, "");
        voiceForLine = secondary;
      } else {
        // Fallback: alternate voices
        voiceForLine = index % 2 === 0 ? primary : secondary;
      }

      const utterance = new SpeechSynthesisUtterance(line);
      utterance.voice = voiceForLine;
      utterance.onstart = () => {
        setCurrentSpokenIndex(index);
      };
      utterance.onend = () => {
        setCurrentSpokenIndex((prev) => (prev === index ? null : prev));
      };
      synth.speak(utterance);
    });
  };

  const toggleGlobalMute = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    setIsGlobalMuted((prev) => {
      const next = !prev;

      if (next) {
        // Muting: stop any ongoing narration
        window.speechSynthesis.cancel();
        setCurrentSpokenIndex(null);
      } else if (aiData && aiData.dialogue) {
        // Unmuting: replay the whole script from the start
        speakDialogue(aiData.dialogue);
      }

      return next;
    });
  };

  useEffect(() => {
    // Robust data fetching with pagination support
    setLoading(true);
    setError(null);
    fetchLocations(page)
      .then(data => {
        if (data?.locations?.results && data.locations.info) {
          setLocations(data.locations.results);
          setTotalPages(data.locations.info.pages || 1);
          setHasNextPage(Boolean(data.locations.info.next));
        } else {
          setError("API returned unexpected data.");
          setLocations([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError("Failed to contact the Multiverse.");
        setLoading(false);
      });
  }, [page]);

  const handleSelectChar = async (char) => {
    // When opening a character, reset AI output & note input
    setSelectedChar(char);
    setAiData(null);
    setAiLoading(false);
    setNoteInput("");
    setIsGlobalMuted(false);
    setCurrentSpokenIndex(null);

    try {
      const data = await getNote(char.id);
      const normalized = (Array.isArray(data) ? data : []).map((n) => ({
        // Support multiple possible backend ID field names
        id: n.note_id ?? n._id ?? n.id ?? null,
        text: n.note,
        timestamp: n.created_at ? new Date(n.created_at).getTime() : Date.now(),
      }));

      setNotes((prev) => ({
        ...prev,
        [char.id]: normalized,
      }));
    } catch (err) {
      console.error(err);
      // Optionally show an error UI/toast
    }
  };

  const handleSaveNote = async () => {
    if (!noteInput.trim()) return;
    if (!selectedChar) return;

    try {
      // First save the new note
      await saveNote(selectedChar.id, noteInput);

      // Immediately refetch notes for this character so we render
      // exactly what the backend has stored (including IDs, timestamps, etc.)
      const data = await getNote(selectedChar.id);
      const normalized = (Array.isArray(data) ? data : []).map((n) => ({
        // Keep ID resolution consistent with initial load so delete stays available
        id: n.note_id ?? n._id ?? n.id ?? null,
        text: n.note,
        timestamp: n.created_at ? new Date(n.created_at).getTime() : Date.now(),
      }));

      setNotes((prev) => ({
        ...prev,
        [selectedChar.id]: normalized,
      }));

      setNoteInput("");
    } catch (err) {
      console.error(err);
      // Optionally surface an error to the user here (toast, alert, etc.)
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!selectedChar || !noteId) return;

    try {
      await deleteNote(noteId);
      setNotes(prev => ({
        ...prev,
        [selectedChar.id]: (prev[selectedChar.id] || []).filter((n) => n.id !== noteId),
      }));
    } catch (err) {
      console.error(err);
      // Optionally surface an error to the user here (toast, alert, etc.)
    }
  };

  const handleGenerate = async () => {
    setAiLoading(true);
    setAiData(null);
    setCurrentSpokenIndex(null);
    stopSpeech();
    const result = await generateDialogue(selectedChar);
    setAiData(result);
    // Only narrate when backend call succeeded (HTTP 200)
    if (result && result.success && result.dialogue && !isGlobalMuted) {
      speakDialogue(result.dialogue);
    }
    setAiLoading(false);
  };

  const handleAiSearch = async () => {
    if (!searchQuery) {
      setSearchResultData(null);
      return;
    }
    setIsSearching(true);
    const data = await semanticSearch(searchQuery);
    
    // Handle both the new structured response and any legacy array responses defensively
    if (data && !Array.isArray(data)) {
      setSearchResultData({
        interpretation: data.interpretation || null,
        count: typeof data.count === "number" ? data.count : (Array.isArray(data.results) ? data.results.length : 0),
        results: Array.isArray(data.results) ? data.results : [],
      });
    } else {
      // Legacy / unexpected response: treat as "no structured results"
      setSearchResultData(null);
    }
    setIsSearching(false);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResultData(null);
  };

  const handleCloseModal = () => {
    // Fully reset modal-related state when closing
    stopSpeech();
    setSelectedChar(null);
    setAiData(null);
    setAiLoading(false);
    setNoteInput("");
    setIsGlobalMuted(false);
    setCurrentSpokenIndex(null);
  };

  // Locations for the main universe view (no longer filtered by AI search)
  const displayLocations = locations;

  const hasSearchResults =
    !!(searchResultData && Array.isArray(searchResultData.results));

  return (
    <div className="min-h-screen bg-purple-950 text-purple-50 p-8 font-sans overflow-x-hidden">
      
      {/* --- HEADER (SEARCH BAR) --- */}
      {/* We render this OUTSIDE any loading checks so it never disappears */}
      <header className="mb-10 border-b border-purple-800 pb-8 flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-500">
            Rick & Morty AI Explorer
          </h1>
          <p className="text-purple-200 mt-2 text-sm">Generative Intelligence & Semantic Search</p>
        </div>
        <div className="w-full md:w-1/3 relative">
          <div className="flex gap-2">
            <input
              type="text"
              className="w-full bg-white border border-purple-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all text-black"
              placeholder="e.g. 'Show me the dead aliens'..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAiSearch()}
            />
            <button
              onClick={handleAiSearch}
              disabled={isSearching || loading}
              className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors disabled:opacity-50"
            >
              {isSearching ? "Thinking..." : "AI Search"}
            </button>
            {hasSearchResults && (
              <button
                onClick={clearSearch}
                className="px-3 bg-red-600 hover:bg-red-500 text-white px-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </header>

      {/* --- CONTENT AREA --- */}

      {/* AI Search Results Area */}
      {!loading && !error && searchResultData && (
        <section className="mb-10 bg-purple-900/70 border border-purple-700 rounded-2xl p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-purple-50">
                Search Results
              </h2>
              <p className="text-sm text-purple-200">
                Showing {searchResultData.count ?? 0} character
                {searchResultData.count === 1 ? "" : "s"} for your query.
              </p>
            </div>
            {searchResultData.interpretation && (
              <div className="text-xs text-purple-200 bg-purple-950/70 px-4 py-2 rounded-lg border border-purple-700 max-w-md">
                <div className="font-semibold mb-1 text-purple-100">
                  Interpreted Filters
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-purple-300">
                    Status:{" "}
                    <span className="font-mono text-purple-100">
                      {searchResultData.interpretation.status || "Any"}
                    </span>
                  </span>
                  <span className="text-purple-300">
                    Species:{" "}
                    <span className="font-mono text-purple-100">
                      {searchResultData.interpretation.species || "Any"}
                    </span>
                  </span>
                  <span className="text-purple-300">
                    Episode:{" "}
                    <span className="font-mono text-purple-100">
                      {searchResultData.interpretation.episode_code ||
                        "Any"}
                    </span>
                  </span>
                  <span className="text-purple-300">
                    Location:{" "}
                    <span className="font-mono text-purple-100">
                      {searchResultData.interpretation.location_name ||
                        "Any"}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {hasSearchResults ? (
            <div className="grid gap-4 grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
              {searchResultData.results.map((char, idx) => (
                <div
                  key={char.id ?? `${char.name}-${idx}`}
                  onClick={() => handleSelectChar(char)}
                  className="cursor-pointer bg-white rounded-xl overflow-hidden hover:ring-2 ring-purple-500 transition-all relative group"
                >
                  {char.image && (
                    <img
                      src={char.image}
                      alt={char.name}
                      className="w-full h-40 object-cover"
                    />
                  )}
                  <div
                    className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide text-white
                    ${
                      char.status === "Alive"
                        ? "bg-green-500"
                        : char.status === "Dead"
                        ? "bg-red-500"
                        : "bg-gray-500"
                    }`}
                  >
                    {char.status || "Unknown"}
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-sm truncate text-purple-950">
                      {char.name}
                    </h3>
                    <p className="text-xs text-purple-950">
                      {char.species || char.location || "Unknown"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-purple-200">
              No characters matched this query.
            </p>
          )}
        </section>
      )}

      {/* 1. Loading State */}
      {loading && (
        <div className="text-center py-20 animate-pulse">
          <p className="text-purple-300 text-xl font-mono">Loading the Multiverse...</p>
        </div>
      )}

      {/* 2. Error State */}
      {!loading && error && (
        <div className="text-center py-20 text-red-400">
          <p className="text-xl">Error: {error}</p>
        </div>
      )}

      {!loading && !error && !searchResultData && displayLocations.length === 0 && (
        <div className="text-center py-20 text-purple-200">
          <p className="text-xl">No entities found based on your filters.</p>
          <button onClick={clearSearch} className="text-purple-300 mt-2 hover:underline">Reset Sensors</button>
        </div>
      )}

      {!loading && !error && !searchResultData && (
        <>
          <div className="space-y-12">
            {displayLocations.map((loc) => (
              <section key={loc.id} className="w-[97vw]">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                  {loc.name} <span className="text-xs font-normal text-purple-200 border border-purple-700 px-2 py-1 rounded">{loc.type}</span>
                </h2>
                <div className="relative">
                  <div
                    ref={(el) => {
                      if (el) {
                        scrollRefs.current[loc.id] = el;
                      }
                    }}
                    className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide"
                  >
                    {loc.residents.map((char) => (
                      <div
                        key={char.id}
                        onClick={() => handleSelectChar(char)}
                        className="min-w-[160px] cursor-pointer bg-white rounded-xl overflow-hidden hover:ring-2 ring-purple-500 transition-all relative group"
                      >
                        <img src={char.image} className="w-full h-40 object-cover" />
                        <div
                          className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide text-white
                          ${char.status === 'Alive' ? 'bg-green-500' : char.status === 'Dead' ? 'bg-red-500' : 'bg-gray-500'}`}
                        >
                          {char.status}
                        </div>
                        <div className="p-3">
                          <h3 className="font-bold text-sm truncate text-purple-950">{char.name}</h3>
                          <p className="text-xs text-purple-950">{char.species}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Horizontal Scroll Controls */}
                  <button
                    type="button"
                    onClick={() => scrollResidents(loc.id, 'left')}
                    className="hidden md:flex items-center justify-center absolute left-1 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-purple-950/80 border border-purple-700 text-purple-100 hover:bg-purple-900 transition-colors shadow-lg"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollResidents(loc.id, 'right')}
                    className="hidden md:flex items-center justify-center absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-purple-950/80 border border-purple-700 text-purple-100 hover:bg-purple-900 transition-colors shadow-lg"
                  >
                    ▶
                  </button>
                </div>
              </section>
            ))}
          </div>

          {/* Pagination Controls */}
          {displayLocations.length > 0 && totalPages > 1 && (
            <div className="fixed inset-x-0 bottom-0 z-40 bg-purple-950/95 border-t border-purple-800">
              <div className="mx-auto max-w-5xl px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
                <span className="text-xs md:text-sm text-purple-200">
                  Page <span className="font-semibold text-purple-100">{page}</span> of{" "}
                  <span className="font-semibold text-purple-100">{totalPages}</span>
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 rounded-lg bg-gray-600 border border-gray-700 text-sm font-semibold text-white hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => hasNextPage && setPage((p) => p + 1)}
                    disabled={!hasNextPage}
                    className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* --- MODAL --- */}
      {selectedChar && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={handleCloseModal}>
          <div
            className="relative bg-purple-950 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col md:flex-row max-h-[90vh] overflow-visible"
            onClick={e => e.stopPropagation()}
          >
            {/* Close Icon */}
            <button
              type="button"
              onClick={handleCloseModal}
              className="absolute -top-3 -right-3 z-10 text-purple-200 hover:text-white bg-purple-900/80 hover:bg-purple-800 rounded-full h-8 w-8 flex items-center justify-center border border-purple-700 shadow-lg"
              aria-label="Close"
            >
              ✕
            </button>
            
            {/* Left Panel */}
            <div className="w-full md:w-1/3 bg-purple-950 p-6 flex flex-col items-center text-center">
              <img src={selectedChar.image} className="w-40 h-40 rounded-full border-4 border-purple-500 shadow-lg mb-4" />
              <h2 className="text-2xl font-bold">{selectedChar.name}</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-bold mt-2 ${selectedChar.status === 'Alive' ? 'bg-purple-900 text-purple-300' : 'bg-purple-800 text-purple-200'}`}>
                {selectedChar.status}
              </span>
              <div className="mt-8 w-full">
                <button
                  onClick={handleGenerate}
                  disabled={aiLoading}
                  className="w-full bg-gradient-to-r from-purple-500 to-purple-700 py-3 rounded-lg font-bold hover:scale-105 transition-transform disabled:opacity-50"
                >
                  {aiLoading ? "Consulting Rick..." : "✨ AI Analysis"}
                </button>
              </div>
            </div>

            {/* Right Panel */}
            <div className="w-full md:w-2/3 p-6 overflow-y-auto bg-purple-900">
              
              {/* AI Output */}
              {aiData && (
                <div className="mb-6 bg-purple-950 rounded-xl overflow-hidden border border-purple-800">
                  <div className="p-4 border-b border-purple-800">
                    <div className="flex items-center justify-between">
                      <div
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => setIsScriptCollapsed((prev) => !prev)}
                      >
                        <h3 className="text-xs font-bold text-purple-200 uppercase tracking-widest">
                          Generated Script
                        </h3>
                        <span className="text-[10px] font-semibold text-purple-300 flex items-center gap-1">
                          {isScriptCollapsed ? "Show" : "Hide"}
                          <span className={`transform transition-transform ${isScriptCollapsed ? "rotate-180" : ""}`}>
                            ▾
                          </span>
                        </span>
                      </div>
                      {/* Global speaker / mute toggle */}
                      <button
                        type="button"
                        onClick={toggleGlobalMute}
                        className={`p-2 rounded-full border bg-black/30 hover:bg-black/60 transition-colors flex items-center justify-center ${
                          isGlobalMuted
                            ? "border-red-400 text-red-400"
                            : "border-green-400 text-green-400"
                        }`}
                        aria-label={isGlobalMuted ? "Unmute script" : "Mute entire script"}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="w-4 h-4"
                          aria-hidden="true"
                        >
                          {/* Speaker body */}
                          <path
                            d="M3 9v6h4l5 5V4L7 9H3z"
                            fill="currentColor"
                          />
                          {/* Sound waves */}
                          {!isGlobalMuted && (
                            <path
                              d="M16 8c1.5 1 2.5 2.7 2.5 4.5S17.5 16 16 17"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          )}
                          {/* Mute slash */}
                          {isGlobalMuted && (
                            <path
                              d="M4 4l16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          )}
                        </svg>
                      </button>
                    </div>
                    {!isScriptCollapsed && (
                      <div className="mt-2 space-y-2 font-mono text-sm">
                        {aiData.dialogue.split('\n').map((line, i) => {
                          const trimmed = line.trim();
                          if (!trimmed) return null;

                          const isRick = trimmed.startsWith('Rick:');
                          const isActive = currentSpokenIndex === i;

                          return (
                            <div
                              key={i}
                              className="flex items-center gap-2"
                            >
                              <p
                                className={`flex-1 p-2 rounded transition-all ${
                                  isRick
                                    ? 'bg-white text-purple-950'
                                    : 'bg-purple-600 text-black'
                                } ${
                                  isActive
                                    ? 'ring-2 ring-green-400'
                                    : ''
                                }`}
                              >
                                {trimmed}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="bg-black/40 p-3 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <h4 className="font-bold text-purple-300 mb-2">FACTUAL CHECKS</h4>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Name</span>
                          <span className={aiData.metrics.heuristics.mentionsName ? "text-purple-300" : "text-purple-500"}>{aiData.metrics.heuristics.mentionsName ? "PASS" : "FAIL"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Status Check</span>
                          <span className={aiData.metrics.heuristics.statusCheck ? "text-purple-300" : "text-purple-500"}>{aiData.metrics.heuristics.statusCheck ? "PASS" : "FAIL"}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-purple-300 mb-2">CREATIVITY</h4>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-yellow-400 text-lg">{"★".repeat(aiData.metrics.rubric.score)}</span>
                        <span className="text-gray-600">/ 5</span>
                      </div>
                    </div>
                  </div>
                  <div className='p-3'>
                      <h6 className="font-bold text-purple-300">Reason</h6>
                      <span className="text-purple-300 text-xs">{aiData.metrics.rubric.reason}</span>
                    </div>
                </div>
              )}

              {/* Notes */}
              <div className="mb-4">
                <h3 className="font-bold text-purple-200 uppercase text-xs mb-3">Field Notes</h3>
                <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                  {(notes[selectedChar.id] || []).length === 0 && <p className="text-purple-300 text-sm">No notes yet.</p>}
                  {(notes[selectedChar.id] || []).map((n, i) => (
                    <div
                      key={n.id || i}
                      className="bg-pink-100 p-2 rounded text-sm text-purple-950 border-l-4 border-pink-500 flex items-start justify-between gap-2"
                    >
                      <span className="flex-1">{n.text}</span>
                      {n.id && (
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(n.id)}
                          className="bg-red-600 text-xs text-white hover:bg-red-700 ml-2 shrink-0 border-none"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-purple-950 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-purple-500 outline-none"
                    placeholder="Add observation..."
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveNote()}
                  />
                  <button onClick={handleSaveNote} className="bg-purple-700 px-4 rounded hover:bg-purple-600">Save</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}