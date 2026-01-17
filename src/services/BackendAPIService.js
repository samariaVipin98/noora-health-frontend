const BACKEND_URL = import.meta.env.VITE_BACKEND_URL; 

export async function generateDialogue(character) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/dialogue/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // FastAPI expects a "GenerateRequest" body with a "character" object inside
      body: JSON.stringify({ character }) 
    });

    const data = await response.json();

    if (!response.ok) throw new Error("Backend error");

    // Mark successful generations so the UI can trigger narration only on 200s
    return { ...data, success: true };
  } catch (error) {
    console.error(error);
    return {
      dialogue: "Rick: (Python Error) I'm not talking to you right now.",
      metrics: { 
        heuristics: { mentionsName: false, statusCheck: false }, 
        rubric: { score: 1, reason: "Server Unreachable" } 
      },
      success: false,
    };
  }
}

export async function semanticSearch(query) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}

// Fetch notes for a specific character via backend API
export async function getNote(characterId) {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/note?character_id=${encodeURIComponent(characterId)}`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch note");
    }

    // Expecting JSON response from backend
    return await response.json();
  } catch (error) {
    console.error("Error fetching note:", error);
    throw error;
  }
}


// Save a note for a specific character via backend API
export async function saveNote(characterId, note) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/note/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        character_id: characterId,
        note,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to save note");
    }

    // Adjust this return shape if your backend responds differently
    return await response.json();
  } catch (error) {
    console.error("Error saving note:", error);
    throw error;
  }
}

// Delete a specific note via backend API
export async function deleteNote(noteId) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/note/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note_id: noteId,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to delete note");
    }

    // Adjust this return shape if your backend responds differently
    return await response.json();
  } catch (error) {
    console.error("Error deleting note:", error);
    throw error;
  }
}