import { lipSyncAnimator } from "./lip-sync"

// Check if the Web Speech API is available
export const isSpeechSynthesisSupported = () => {
  try {
    return typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined"
  } catch (error) {
    console.error("Error checking speech synthesis support:", error)
    return false
  }
}

// Store failed attempts to detect persistent issues
let failedAttempts = 0
const MAX_FAILED_ATTEMPTS = 3
let speechDisabled = false

// Flag to track if speech is currently in progress
let isSpeaking = false

// Function to speak text
export const speakText = (text: string, onEnd?: () => void) => {
  // If speech has been disabled due to persistent failures, skip directly to onEnd
  if (speechDisabled) {
    console.warn("Speech synthesis has been temporarily disabled due to persistent failures")
    if (onEnd) onEnd()
    return
  }

  if (!isSpeechSynthesisSupported()) {
    console.warn("Speech synthesis is not supported in this browser")
    if (onEnd) onEnd()
    return
  }

  try {
    // If already speaking, cancel it first
    if (isSpeaking) {
      window.speechSynthesis.cancel()
      // Small delay to ensure cancellation completes
      setTimeout(() => {
        startSpeaking(text, onEnd)
      }, 100)
    } else {
      startSpeaking(text, onEnd)
    }
  } catch (error) {
    console.error("Error in speech synthesis:", error)
    lipSyncAnimator.stop()
    if (onEnd) onEnd()
  }
}

// Helper function to actually start the speech
const startSpeaking = (text: string, onEnd?: () => void) => {
  try {
    // Set speaking flag
    isSpeaking = true

    // Start lip sync animation with the text
    lipSyncAnimator.start(text)

    // For longer text, break it into sentences to improve reliability
    if (text.length > 100) {
      speakTextInChunks(text, onEnd)
      return
    }

    // Create a new utterance
    const utterance = new SpeechSynthesisUtterance(text)

    // Set language to English for better compatibility
    utterance.lang = "en-US"

    // Set a slightly lower pitch for a more natural sound
    utterance.pitch = 0.9

    // Set a moderate rate of speech
    utterance.rate = 0.9

    // Handle end event
    utterance.onend = () => {
      // Stop lip sync animation
      lipSyncAnimator.stop()
      // Reset failed attempts counter on success
      failedAttempts = 0
      // Reset speaking flag
      isSpeaking = false
      if (onEnd) onEnd()
    }

    // Add improved error handling
    utterance.onerror = (event) => {
      // Stop lip sync animation on error
      lipSyncAnimator.stop()

      // Safely log error without stringifying the entire event object
      console.error("Speech synthesis error occurred")

      // Try to log error type if available
      if (event && event.error) {
        console.error("Error type:", event.error)
      }

      // Don't count interrupted errors as failures
      if (event && event.error !== "interrupted") {
        failedAttempts++
      }

      // If we've had multiple failures in a row, temporarily disable speech
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        console.warn(`Speech synthesis failed ${failedAttempts} times in a row. Temporarily disabling.`)
        speechDisabled = true

        // Re-enable after 5 minutes
        setTimeout(
          () => {
            speechDisabled = false
            failedAttempts = 0
            console.log("Speech synthesis re-enabled")
          },
          5 * 60 * 1000,
        )
      }

      // Reset speaking flag
      isSpeaking = false

      // Call onEnd callback to ensure UI is updated
      if (onEnd) onEnd()
    }

    // Speak the text
    window.speechSynthesis.speak(utterance)

    // Set a timeout to ensure onEnd is called even if speech synthesis fails silently
    const maxSpeechTime = Math.min(text.length * 50, 10000) // Estimate based on text length, max 10 seconds
    const fallbackTimeout = setTimeout(() => {
      if (window.speechSynthesis.speaking) {
        // If still speaking after the expected time, assume it's stuck
        window.speechSynthesis.cancel()
        lipSyncAnimator.stop()
        isSpeaking = false
        if (onEnd) onEnd()
      }
    }, maxSpeechTime + 1000) // Add 1 second buffer

    // Clear the timeout if speech ends normally
    utterance.onend = () => {
      clearTimeout(fallbackTimeout)
      // Stop lip sync animation
      lipSyncAnimator.stop()
      // Reset failed attempts counter on success
      failedAttempts = 0
      // Reset speaking flag
      isSpeaking = false
      if (onEnd) onEnd()
    }
  } catch (error) {
    console.error("Error starting speech synthesis:", error)
    lipSyncAnimator.stop()
    isSpeaking = false
    if (onEnd) onEnd()
  }
}

// Function to speak text in chunks for better reliability
const speakTextInChunks = (text: string, onEnd?: () => void) => {
  // Split text into sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  let currentIndex = 0

  // Start lip sync for the entire text
  lipSyncAnimator.start(text)

  const speakNextChunk = () => {
    if (currentIndex >= sentences.length) {
      lipSyncAnimator.stop()
      isSpeaking = false
      if (onEnd) onEnd()
      return
    }

    const chunk = sentences[currentIndex]
    currentIndex++

    try {
      const utterance = new SpeechSynthesisUtterance(chunk)
      utterance.lang = "en-US"
      utterance.pitch = 0.9
      utterance.rate = 0.9

      utterance.onend = () => {
        // Small pause between sentences for more natural speech
        setTimeout(speakNextChunk, 200)
      }

      utterance.onerror = (event) => {
        console.error("Chunk speech error:", event && event.error ? event.error : "unknown error")

        // If one chunk fails, try to continue with the next
        // Don't count interrupted errors as failures
        if (event && event.error !== "interrupted") {
          console.warn("Error speaking chunk, moving to next")
        }

        // Continue with next chunk after a short delay
        setTimeout(speakNextChunk, 200)
      }

      window.speechSynthesis.speak(utterance)
    } catch (error) {
      console.error("Error in chunk speech synthesis:", error)
      speakNextChunk() // Try next chunk
    }
  }

  speakNextChunk()
}

// Function to stop speaking
export const stopSpeaking = () => {
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel()
      lipSyncAnimator.stop()
      isSpeaking = false
    } catch (error) {
      console.error("Error stopping speech:", error)
    }
  }
}

// Function to check if speech synthesis is currently disabled
export const isSpeechDisabled = () => {
  return speechDisabled
}

// Function to manually reset speech synthesis if needed
export const resetSpeechSynthesis = () => {
  failedAttempts = 0
  speechDisabled = false
  isSpeaking = false
  lipSyncAnimator.stop()
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel()
    } catch (error) {
      console.error("Error canceling speech during reset:", error)
    }
  }
  console.log("Speech synthesis manually reset")
}

// Function to check if lip sync is currently active
export const isLipSyncActive = () => {
  return lipSyncAnimator.isAnimating()
}

// Function to get current mouth openness
export const getCurrentMouthOpenness = () => {
  return lipSyncAnimator.getCurrentOpenness()
}
