"use client";
import { useEffect, useRef, useState } from "react";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import { useCall } from "@/context/CallContext";
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export default function CallManager() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { outgoingCallData, setOutgoingCallData, setIsInCall } = useCall();
  
  const [incomingCall, setIncomingCall] = useState<{ from: string; name: string; avatar?: string; signal: RTCSessionDescriptionInit } | null>(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  
  const myVideo = useRef<HTMLVideoElement>(null);
  const userVideo = useRef<HTMLVideoElement>(null);
  const connectionRef = useRef<RTCPeerConnection | null>(null);
  const incomingRingtone = useRef<HTMLAudioElement | null>(null);
  const outgoingRingtone = useRef<HTMLAudioElement | null>(null);
  const mediaPrimed = useRef(false); // Track if media has been primed

  // Function to prime all media elements with user gesture
  const primeAllMedia = () => {
    if (mediaPrimed.current) {
      console.log("⏭️ Media already primed, skipping");
      return;
    }

    console.log("🎯 Priming all media elements with user gesture...");

    // Prime ringtones with muted playback first
    if (incomingRingtone.current && outgoingRingtone.current) {
      const primeAudio = (audio: HTMLAudioElement, name: string) => {
        audio.muted = true; // Muted autoplay is allowed
        audio.play().then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false; // Unmute after successful play
          audio.volume = 1;
          console.log(`✅ ${name} primed with muted autoplay`);
        }).catch(() => console.log(`⏸️ ${name} blocked even when muted`));
      };

      primeAudio(incomingRingtone.current, "Incoming ringtone");
      primeAudio(outgoingRingtone.current, "Outgoing ringtone");
    }

    // Prime video element - set muted for autoplay
    if (userVideo.current) {
      userVideo.current.muted = false; // WebRTC audio should NOT be muted
      userVideo.current.volume = 1;
      console.log("✅ WebRTC audio element configured for unmuted playback");
    }

    mediaPrimed.current = true;
    console.log("🎉 Media priming complete!");
  };

  // Initialize audio on mount
  useEffect(() => {
    incomingRingtone.current = new Audio("/music/callin.mp3");
    incomingRingtone.current.loop = true;
    incomingRingtone.current.volume = 1;
    outgoingRingtone.current = new Audio("/music/ringing.mp3");
    outgoingRingtone.current.loop = true;
    outgoingRingtone.current.volume = 1;

    // Don't prime on mount - wait for user gesture (call action)
  }, []);

  // Local cleanup without emitting (used when receiving call-ended event)
  const endCallLocally = () => {
    // Stop all ringtones
    incomingRingtone.current?.pause();
    outgoingRingtone.current?.pause();
    if (incomingRingtone.current) incomingRingtone.current.currentTime = 0;
    if (outgoingRingtone.current) outgoingRingtone.current.currentTime = 0;
    
    // Close peer connection
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }
    
    // Stop all media tracks
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
      setStream(null);
    }
    
    // Clear video elements
    if (myVideo.current) myVideo.current.srcObject = null;
    if (userVideo.current) userVideo.current.srcObject = null;
    
    // Reset state
    setIncomingCall(null);
    setOutgoingCallData(null);
    setCallAccepted(false);
    setIsInCall(false);
    setIsMicOn(true);
    setAudioBlocked(false);
    
    // Remove socket listeners
    socket?.off("call-answered");
    socket?.off("signal-received");
  };

  // End call function - notifies other party and cleans up
  const endCall = () => {
    // Notify the other party that call is ending
    const otherUserId = incomingCall?.from || outgoingCallData?.userId;
    if (otherUserId && socket) {
      console.log("📴 Ending call and notifying other party:", otherUserId);
      socket.emit("end-call", { to: otherUserId, from: user?._id });
    }
    
    // Perform local cleanup
    endCallLocally();
  };

  // Handle Socket Events for Incoming Calls
  useEffect(() => {
    if (!socket) return;

    socket.on("call-made", (data) => {
      setIncomingCall({ from: data.from, name: data.name, avatar: data.avatar, signal: data.signal });
      setIsInCall(true);
      // Play incoming ringtone - will work after user clicks accept/decline
      console.log("📞 Incoming call - ringtone will play on user interaction");
    });

    // Listen for call ended by other party
    socket.on("call-ended", () => {
      console.log("📴 Other party ended the call");
      endCallLocally(); // Use local cleanup without emitting again
    });

    return () => {
      socket.off("call-made");
      socket.off("call-ended");
    };
  }, [socket, setIsInCall]);

  // Play outgoing ringtone when making a call
  useEffect(() => {
    if (outgoingCallData && !callAccepted) {
      // Prime media with user gesture (call button was clicked)
      primeAllMedia();
      
      // Play with fallback to muted if blocked
      if (outgoingRingtone.current) {
        outgoingRingtone.current.volume = 1;
        outgoingRingtone.current.muted = false;
        outgoingRingtone.current.play().catch(err => {
          console.log("🔇 Outgoing ringtone blocked, trying muted");
          if (outgoingRingtone.current) {
            outgoingRingtone.current.muted = true;
            outgoingRingtone.current.play().catch(e => console.log("❌ Even muted ringtone failed"));
          }
        });
      }
    }
  }, [outgoingCallData, callAccepted]);

  const startCall = async (idToCall: string) => {
    // 1. Get Media - Audio only for voice calls
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      setStream(currentStream);
      if (myVideo.current) myVideo.current.srcObject = currentStream;

      console.log("[CALLER] Got local stream with tracks:", currentStream.getTracks().map(t => t.kind));

      // 2. Create Peer with STUN + TURN servers for better connectivity
      const peer = new RTCPeerConnection({
        iceServers: [
          // Google STUN servers
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
          // Metered TURN servers (free tier)
          { 
            urls: "turn:a.relay.metered.ca:80",
            username: "87a60b73f341b6abffa20ad6",
            credential: "ePS6V5R5d+xpKOH8"
          },
          { 
            urls: "turn:a.relay.metered.ca:443",
            username: "87a60b73f341b6abffa20ad6",
            credential: "ePS6V5R5d+xpKOH8"
          },
          { 
            urls: "turn:a.relay.metered.ca:443?transport=tcp",
            username: "87a60b73f341b6abffa20ad6",
            credential: "ePS6V5R5d+xpKOH8"
          }
        ],
        iceCandidatePoolSize: 10,
        iceTransportPolicy: "all" // Use both STUN and TURN
      });
      connectionRef.current = peer;

      // Add tracks
      currentStream.getTracks().forEach(track => {
        const sender = peer.addTrack(track, currentStream);
        console.log("[CALLER] Added track:", track.kind, track.enabled);
      });

      // Monitor connection state - don't give up immediately on failure
      let connectionFailureTimeout: NodeJS.Timeout | null = null;
      peer.onconnectionstatechange = () => {
        console.log("[CALLER] Connection state:", peer.connectionState);
        
        if (peer.connectionState === "connected") {
          console.log("✅ [CALLER] Connection established successfully!");
          if (connectionFailureTimeout) clearTimeout(connectionFailureTimeout);
        } else if (peer.connectionState === "failed") {
          console.error("❌ [CALLER] Connection failed! Waiting 3s before giving up...");
          // Give it some time before ending - ICE might still be working
          connectionFailureTimeout = setTimeout(() => {
            console.log("❌ [CALLER] Connection still failed after 3s, ending call");
            endCall();
          }, 3000);
        } else if (peer.connectionState === "disconnected") {
          console.log("⚠️ [CALLER] Connection disconnected, waiting for reconnection...");
        }
      };

      peer.oniceconnectionstatechange = () => {
        console.log("[CALLER] ICE connection state:", peer.iceConnectionState);
        
        if (peer.iceConnectionState === "connected" || peer.iceConnectionState === "completed") {
          console.log("✅ [CALLER] ICE connection established!");
          if (connectionFailureTimeout) clearTimeout(connectionFailureTimeout);
        } else if (peer.iceConnectionState === "failed") {
          console.error("❌ [CALLER] ICE connection failed! Network/firewall issue.");
        }
      };

      // Monitor ICE gathering state
      peer.onicegatheringstatechange = () => {
        console.log("[CALLER] ICE gathering state:", peer.iceGatheringState);
      };

      // Handle ICE candidates - send them as they're discovered
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("[CALLER] Sending ICE candidate (type:", event.candidate.type, ")");
          socket?.emit("send-signal", { to: idToCall, signal: { candidate: event.candidate }, from: user?._id });
        } else {
          console.log("[CALLER] All ICE candidates have been sent");
        }
      };

      // Handle incoming stream from answerer
      peer.ontrack = (event) => {
        console.log("[CALLER] Received remote track:", event.track.kind, event.streams.length);
        if (userVideo.current && event.streams[0]) {
          userVideo.current.srcObject = event.streams[0];
          userVideo.current.muted = false; // Ensure NOT muted for call audio
          userVideo.current.volume = 1;
          console.log("[CALLER] Set remote stream, tracks:", event.streams[0].getTracks().map(t => `${t.kind} enabled:${t.enabled}`));
          
          // Play immediately - browser should allow since user initiated call
          userVideo.current.play().then(() => {
            console.log("✅ [CALLER] Remote audio playing - volume:", userVideo.current!.volume, "muted:", userVideo.current!.muted);
            setAudioBlocked(false);
          }).catch(err => {
            console.error("❌ [CALLER] Remote audio blocked:", err);
            setAudioBlocked(true);
            console.log("👆 [CALLER] User interaction required - click anywhere to enable audio");
          });
        }
      };

      // Create Offer
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      console.log("[CALLER] Created offer");

      // Emit Call (send full offer with type and sdp)
      socket?.emit("call-user", {
        userToCall: idToCall,
        signalData: offer, // Contains both type and sdp
        from: user?._id,
        name: user?.name,
        avatar: user?.avatarConfig?.image
      });

      // Listen for Answer
      socket?.on("call-answered", async (data) => {
        console.log("[CALLER] Received answer", data.signal ? 'with signal' : 'NO SIGNAL');
        if (data.signal && data.signal.type && data.signal.sdp) {
          await peer.setRemoteDescription(new RTCSessionDescription(data.signal));
          console.log("[CALLER] Set remote description (answer)");
          // Stop outgoing ringtone when call is accepted
          outgoingRingtone.current?.pause();
          if (outgoingRingtone.current) outgoingRingtone.current.currentTime = 0;
          setCallAccepted(true);
        } else {
          console.error("[CALLER] Invalid signal data received in call-answered:", data.signal);
        }
      });

      // Listen for ICE from other side - add with error handling
      socket?.on("signal-received", async (data) => {
        if (data.signal.candidate) {
          console.log("[CALLER] Received ICE candidate from answerer (type:", data.signal.candidate.type, ")");
          try {
            await peer.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
            console.log("[CALLER] Successfully added ICE candidate");
          } catch (err) {
            console.error("[CALLER] Error adding ICE candidate:", err);
          }
        }
      });

    } catch (err) {
      console.error("Failed to start call", err);
      endCall();
    }
  };

  const toggleMic = () => {
    const audioTrack = stream?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !isMicOn;
      setIsMicOn(!isMicOn);
    }
  };

  const enableAudio = () => {
    if (userVideo.current && audioBlocked) {
      userVideo.current.play().then(() => {
        console.log("✅ Audio enabled by user click");
        setAudioBlocked(false);
      }).catch(err => {
        console.error("❌ Still blocked:", err);
      });
    }
  };

  const answerCall = async () => {
    if (!incomingCall) return;
    
    // Prime media with user gesture (answer button was clicked)
    primeAllMedia();
    
    // Play incoming ringtone now that user clicked
    if (incomingRingtone.current) {
      incomingRingtone.current.muted = false;
      incomingRingtone.current.volume = 1;
      incomingRingtone.current.play().then(() => {
        console.log("🔔 Incoming ringtone playing");
        // Stop after a moment since we're answering
        setTimeout(() => {
          incomingRingtone.current?.pause();
          if (incomingRingtone.current) incomingRingtone.current.currentTime = 0;
        }, 500);
      }).catch(err => console.log("🔇 Ringtone play failed:", err));
    }
    
    setCallAccepted(true);

    try {
       const currentStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
       setStream(currentStream);
       if (myVideo.current) myVideo.current.srcObject = currentStream;

       console.log("[ANSWERER] Got local stream with tracks:", currentStream.getTracks().map(t => t.kind));

       // Create Peer with STUN + TURN servers for better connectivity
       const peer = new RTCPeerConnection({
        iceServers: [
          // Google STUN servers
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
          // Metered TURN servers (free tier)
          { 
            urls: "turn:a.relay.metered.ca:80",
            username: "87a60b73f341b6abffa20ad6",
            credential: "ePS6V5R5d+xpKOH8"
          },
          { 
            urls: "turn:a.relay.metered.ca:443",
            username: "87a60b73f341b6abffa20ad6",
            credential: "ePS6V5R5d+xpKOH8"
          },
          { 
            urls: "turn:a.relay.metered.ca:443?transport=tcp",
            username: "87a60b73f341b6abffa20ad6",
            credential: "ePS6V5R5d+xpKOH8"
          }
        ],
        iceCandidatePoolSize: 10,
        iceTransportPolicy: "all" // Use both STUN and TURN
      });
      connectionRef.current = peer;

      // Add tracks
      currentStream.getTracks().forEach(track => {
        const sender = peer.addTrack(track, currentStream);
        console.log("[ANSWERER] Added track:", track.kind, track.enabled);
      });

      // Monitor connection state - don't give up immediately on failure
      let connectionFailureTimeout: NodeJS.Timeout | null = null;
      peer.onconnectionstatechange = () => {
        console.log("[ANSWERER] Connection state:", peer.connectionState);
        
        if (peer.connectionState === "connected") {
          console.log("✅ [ANSWERER] Connection established successfully!");
          if (connectionFailureTimeout) clearTimeout(connectionFailureTimeout);
        } else if (peer.connectionState === "failed") {
          console.error("❌ [ANSWERER] Connection failed! Waiting 3s before giving up...");
          // Give it some time before ending - ICE might still be working
          connectionFailureTimeout = setTimeout(() => {
            console.log("❌ [ANSWERER] Connection still failed after 3s, ending call");
            endCall();
          }, 3000);
        } else if (peer.connectionState === "disconnected") {
          console.log("⚠️ [ANSWERER] Connection disconnected, waiting for reconnection...");
        }
      };

      peer.oniceconnectionstatechange = () => {
        console.log("[ANSWERER] ICE connection state:", peer.iceConnectionState);
        
        if (peer.iceConnectionState === "connected" || peer.iceConnectionState === "completed") {
          console.log("✅ [ANSWERER] ICE connection established!");
          if (connectionFailureTimeout) clearTimeout(connectionFailureTimeout);
        } else if (peer.iceConnectionState === "failed") {
          console.error("❌ [ANSWERER] ICE connection failed! Network/firewall issue.");
        }
      };

      // Monitor ICE gathering state
      peer.onicegatheringstatechange = () => {
        console.log("[ANSWERER] ICE gathering state:", peer.iceGatheringState);
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("[ANSWERER] Sending ICE candidate (type:", event.candidate.type, ")");
           socket?.emit("send-signal", { to: incomingCall.from, signal: { candidate: event.candidate }, from: user?._id });
        } else {
          console.log("[ANSWERER] All ICE candidates have been sent");
        }
      };

      peer.ontrack = (event) => {
        console.log("[ANSWERER] Received remote track:", event.track.kind, event.streams.length);
        if (userVideo.current && event.streams[0]) {
          userVideo.current.srcObject = event.streams[0];
          userVideo.current.muted = false; // Ensure NOT muted for call audio
          userVideo.current.volume = 1;
          console.log("[ANSWERER] Set remote stream, tracks:", event.streams[0].getTracks().map(t => `${t.kind} enabled:${t.enabled}`));
          
          // Play immediately - browser should allow since user clicked answer
          userVideo.current.play().then(() => {
            console.log("✅ [ANSWERER] Remote audio playing - volume:", userVideo.current!.volume, "muted:", userVideo.current!.muted);
            setAudioBlocked(false);
          }).catch(err => {
            console.error("❌ [ANSWERER] Remote audio blocked:", err);
            setAudioBlocked(true);
            console.log("👆 [ANSWERER] User interaction required - click anywhere to enable audio");
          });
        }
      };

      // Set Remote from incoming
      if (incomingCall.signal && incomingCall.signal.type && incomingCall.signal.sdp) {
        console.log("[ANSWERER] Setting remote description (offer)");
        await peer.setRemoteDescription(new RTCSessionDescription(incomingCall.signal));
      } else {
        console.error("[ANSWERER] Invalid signal data in incoming call:", incomingCall.signal);
        throw new Error("Invalid call signal data");
      }

      // Create Answer
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      console.log("[ANSWERER] Created answer");

      // Emit Answer (send full answer with type and sdp)
      socket?.emit("answer-call", {
        signal: answer, // Contains both type and sdp
        to: incomingCall.from,
        from: user?._id
      });
      
// Listen for Candidates from caller - add with error handling
      socket?.on("signal-received", async (data) => {
         if (data.signal.candidate) {
           console.log("[ANSWERER] Received ICE candidate from caller (type:", data.signal.candidate.type, ")");
           try {
             await peer.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
             console.log("[ANSWERER] Successfully added ICE candidate");
           } catch (err) {
             console.error("[ANSWERER] Error adding ICE candidate:", err);
           }
         }
      });

    } catch (err) {
      console.log(err);
      endCall();
    }
  };

  // Handle Outgoing Call Trigger
  useEffect(() => {
    if (outgoingCallData && !callAccepted) {
      startCall(outgoingCallData.userId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outgoingCallData, callAccepted]);

  // UI RENDER
  if (!incomingCall && !outgoingCallData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md" onClick={enableAudio}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-8 w-full max-w-md mx-4 flex flex-col items-center relative shadow-2xl">
        
        {/* Audio Blocked Banner */}
        {audioBlocked && callAccepted && (
          <div className="absolute top-4 left-4 right-4 bg-yellow-500/90 text-black px-4 py-2 rounded-xl text-sm font-medium text-center animate-pulse">
            🔊 Click anywhere to enable audio
          </div>
        )}
        
        {/* Connection Status */}
        {!callAccepted && (
          <div className="flex flex-col items-center justify-center py-8">
             {/* Show avatar for incoming call */}
             {incomingCall && (
               <div className="w-32 h-32 rounded-full overflow-hidden mb-6 ring-4 ring-green-500 ring-offset-4 ring-offset-zinc-900">
                 {incomingCall.avatar ? (
                   <img src={incomingCall.avatar} alt={incomingCall.name} className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full h-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                     <span className="text-4xl font-bold text-white">{incomingCall.name[0].toUpperCase()}</span>
                   </div>
                 )}
               </div>
             )}
             {!incomingCall && outgoingCallData && (
               <div className="w-32 h-32 rounded-full overflow-hidden mb-6 ring-4 ring-blue-500 ring-offset-4 ring-offset-zinc-900 animate-pulse">
                 {outgoingCallData.userAvatar ? (
                   <img src={outgoingCallData.userAvatar} alt={outgoingCallData.userName} className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                     <span className="text-4xl font-bold text-white">{outgoingCallData.userName[0].toUpperCase()}</span>
                   </div>
                 )}
               </div>
             )}
             {incomingCall ? (
                <>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <h3 className="text-2xl font-medium text-white text-center">{incomingCall.name}</h3>
                    <img src="/Verification-Blue-Tick-PNG.webp" alt="Verified" className="w-6 h-6 flex-shrink-0" />
                  </div>
                  <p className="text-zinc-400 mb-8">Incoming voice call...</p>
                  <div className="flex gap-6">
                     <div className="flex flex-col items-center gap-2">
                       <button onClick={endCall} className="bg-red-500 hover:bg-red-600 p-5 rounded-full transition-all shadow-lg hover:shadow-red-500/50 cursor-pointer">
                         <PhoneOff className="text-white" size={28} />
                       </button>
                       <span className="text-xs text-zinc-500">Decline</span>
                     </div>
                     <div className="flex flex-col items-center gap-2">
                       <button onClick={answerCall} className="bg-green-500 hover:bg-green-600 p-5 rounded-full transition-all animate-bounce shadow-lg hover:shadow-green-500/50 cursor-pointer">
                         <Phone className="text-white" size={28} />
                       </button>
                       <span className="text-xs text-zinc-500">Accept</span>
                     </div>
                  </div>
                </>
             ) : (
                <>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <h3 className="text-2xl font-medium text-white text-center">{outgoingCallData?.userName}</h3>
                    <img src="/Verification-Blue-Tick-PNG.webp" alt="Verified" className="w-6 h-6 flex-shrink-0" />
                  </div>
                  <p className="text-zinc-400 mb-8">Calling...</p>
                  <div className="flex flex-col items-center gap-2">
                    <button onClick={endCall} className="bg-red-500 hover:bg-red-600 p-5 rounded-full transition-all shadow-lg hover:shadow-red-500/50 cursor-pointer">
                      <PhoneOff className="text-white" size={28} />
                    </button>
                    <span className="text-xs text-zinc-500">End call</span>
                  </div>
                </>
             )}
          </div>
        )}

        {/* Audio Call Connected View */}
        {callAccepted && (
          <div className="flex flex-col items-center py-8 w-full">
            <div className="w-48 h-48 mb-2">
              <DotLottieReact
                src="/Lotties/love.lottie"
                loop
                autoplay
              />
            </div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <h3 className="text-2xl font-medium text-white">{incomingCall?.name || outgoingCallData?.userName}</h3>
              <img src="/Verification-Blue-Tick-PNG.webp" alt="Verified" className="w-6 h-6 flex-shrink-0" />
            </div>
            <div className="flex items-center gap-2 mb-8">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm text-emerald-400">Connected</span>
            </div>
            
            {/* Call Controls */}
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-center gap-2">
                <button 
                  onClick={toggleMic} 
                  className={`p-4 rounded-full transition-all cursor-pointer ${
                    !isMicOn ? 'bg-red-500 text-white shadow-lg shadow-red-500/50' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
                </button>
                <span className="text-xs text-zinc-500">{isMicOn ? 'Mute' : 'Unmute'}</span>
              </div>
              
              <div className="flex flex-col items-center gap-2">
                <button 
                  onClick={endCall} 
                  className="p-5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg hover:shadow-red-500/50 cursor-pointer"
                >
                  <PhoneOff size={28} />
                </button>
                <span className="text-xs text-zinc-500">End call</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Hidden video elements for audio streaming */}
        <div className="hidden">
          <video playsInline muted ref={myVideo} autoPlay />
          <video playsInline ref={userVideo} autoPlay controls={false} />
        </div>
      </div>
    </div>
  );
}
