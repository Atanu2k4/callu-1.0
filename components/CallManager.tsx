"use client";
import { useEffect, useRef, useState } from "react";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import { useCall } from "@/context/CallContext";
import { Phone, PhoneOff, Mic, MicOff, PhoneIncoming } from "lucide-react";

export default function CallManager() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { outgoingCallData, setOutgoingCallData } = useCall();
  
  const [incomingCall, setIncomingCall] = useState<{ from: string; name: string; signal: RTCSessionDescriptionInit } | null>(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  
  const myVideo = useRef<HTMLVideoElement>(null);
  const userVideo = useRef<HTMLVideoElement>(null);
  const connectionRef = useRef<RTCPeerConnection | null>(null);

  // Handle Socket Events for Incoming Calls
  useEffect(() => {
    if (!socket) return;

    socket.on("call-made", (data) => {
      setIncomingCall({ from: data.from, name: data.name, signal: data.signal });
    });

    return () => {
      socket.off("call-made");
    };
  }, [socket]);

  const startCall = async (idToCall: string) => {
    // 1. Get Media - Audio only for voice calls
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      setStream(currentStream);
      if (myVideo.current) myVideo.current.srcObject = currentStream;

      // 2. Create Peer
      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });
      connectionRef.current = peer;

      // Add tracks
      currentStream.getTracks().forEach(track => peer.addTrack(track, currentStream));

      // Handle ICE
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          // Send candidate (we use signal-received generic channel or piggyback?)
          // For raw WebRTC, we need full signaling. 
          // Simplified: Just use 'send-signal' for everything.
          socket?.emit("send-signal", { to: idToCall, signal: { candidate: event.candidate }, from: user?._id });
        }
      };

      // Handle incoming stream
      peer.ontrack = (event) => {
        if (userVideo.current) userVideo.current.srcObject = event.streams[0];
      };

      // Create Offer
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      // Emit Call
      socket?.emit("call-user", {
        userToCall: idToCall,
        signalData: { sdp: offer }, // Wrap nicely
        from: user?._id,
        name: user?.name
      });

      // Listen for Answer
      socket?.on("call-answered", async (data) => {
        if (data.signal.sdp) {
          await peer.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
          setCallAccepted(true);
        }
      });

      // Listen for ICE from other side
      socket?.on("signal-received", async (data) => {
        if (data.signal.candidate) {
           await peer.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
        }
      });

    } catch (err) {
      console.error("Failed to start call", err);
      endCall();
    }
  };

  const answerCall = async () => {
    if (!incomingCall) return;
    
    setCallAccepted(true);

    try {
       const currentStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
       setStream(currentStream);
       if (myVideo.current) myVideo.current.srcObject = currentStream;

       const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });
      connectionRef.current = peer;

      currentStream.getTracks().forEach(track => peer.addTrack(track, currentStream));

      peer.onicecandidate = (event) => {
        if (event.candidate) {
           socket?.emit("send-signal", { to: incomingCall.from, signal: { candidate: event.candidate }, from: user?._id });
        }
      };

      peer.ontrack = (event) => {
        if (userVideo.current) userVideo.current.srcObject = event.streams[0];
      };

      // Set Remote from incoming
      if (incomingCall.signal.sdp) {
        await peer.setRemoteDescription(new RTCSessionDescription(incomingCall.signal.sdp));
      }

      // Create Answer
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      // Emit Answer
      socket?.emit("answer-call", {
        signal: { sdp: answer },
        to: incomingCall.from,
        from: user?._id
      });
      
      // Listen for Candidates from caller
      socket?.on("signal-received", async (data) => {
         if (data.signal.candidate) {
            await peer.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
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
  }, [outgoingCallData, callAccepted]);

  const endCall = () => {
    connectionRef.current?.close();
    setIncomingCall(null);
    setOutgoingCallData(null);
    setCallAccepted(false);
    stream?.getTracks().forEach(t => t.stop());
    window.location.reload(); // Simplest cleanup for WebRTC state
  };

  // UI RENDER
  if (!incomingCall && !outgoingCallData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-8 w-full max-w-md mx-4 flex flex-col items-center relative shadow-2xl">
        
        {/* Connection Status */}
        {!callAccepted && (
          <div className="flex flex-col items-center justify-center py-8">
             {/* Show ringing animation for incoming call */}
             {incomingCall && (
               <div className="relative mb-8">
                 <div className="w-32 h-32 bg-green-500/20 rounded-full flex items-center justify-center">
                   <div className="w-24 h-24 bg-green-500/30 rounded-full flex items-center justify-center animate-pulse">
                     <PhoneIncoming className="w-12 h-12 text-green-500 animate-bounce" />
                   </div>
                 </div>
                 <div className="absolute inset-0 rounded-full bg-green-500/10 animate-ping" />
               </div>
             )}
             {!incomingCall && outgoingCallData && (
               <div className="relative mb-8">
                 <div className="w-32 h-32 bg-blue-500/20 rounded-full flex items-center justify-center">
                   <div className="w-24 h-24 bg-blue-500/30 rounded-full flex items-center justify-center animate-pulse">
                     <Phone className="w-12 h-12 text-blue-500" />
                   </div>
                 </div>
                 <div className="absolute inset-0 rounded-full bg-blue-500/10 animate-ping" />
               </div>
             )}
             {incomingCall ? (
                <>
                  <h3 className="text-2xl font-medium text-white mb-1 text-center">{incomingCall.name}</h3>
                  <p className="text-zinc-400 mb-8">Incoming voice call...</p>
                  <div className="flex gap-6">
                     <div className="flex flex-col items-center gap-2">
                       <button onClick={endCall} className="bg-red-500 hover:bg-red-600 p-5 rounded-full transition-all shadow-lg hover:shadow-red-500/50">
                         <PhoneOff className="text-white" size={28} />
                       </button>
                       <span className="text-xs text-zinc-500">Decline</span>
                     </div>
                     <div className="flex flex-col items-center gap-2">
                       <button onClick={answerCall} className="bg-green-500 hover:bg-green-600 p-5 rounded-full transition-all animate-bounce shadow-lg hover:shadow-green-500/50">
                         <Phone className="text-white" size={28} />
                       </button>
                       <span className="text-xs text-zinc-500">Accept</span>
                     </div>
                  </div>
                </>
             ) : (
                <>
                  <h3 className="text-2xl font-medium text-white mb-1 text-center">{outgoingCallData?.userName}</h3>
                  <p className="text-zinc-400 mb-8">Calling...</p>
                  <div className="flex flex-col items-center gap-2">
                    <button onClick={endCall} className="bg-red-500 hover:bg-red-600 p-5 rounded-full transition-all shadow-lg hover:shadow-red-500/50">
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
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/30">
              <Phone className="w-16 h-16 text-white" />
            </div>
            <h3 className="text-2xl font-medium text-white mb-1">{incomingCall?.name || outgoingCallData?.userName}</h3>
            <div className="flex items-center gap-2 mb-8">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm text-emerald-400">Connected</span>
            </div>
            
            {/* Call Controls */}
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-center gap-2">
                <button 
                  onClick={() => {
                    const audioTrack = stream?.getAudioTracks()[0];
                    if (audioTrack) {
                      audioTrack.enabled = !isMicOn;
                      setIsMicOn(!isMicOn);
                    }
                  }} 
                  className={`p-4 rounded-full transition-all ${
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
                  className="p-5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg hover:shadow-red-500/50"
                >
                  <PhoneOff size={28} />
                </button>
                <span className="text-xs text-zinc-500">End call</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Hidden video elements for audio-only call */}
        <div className="hidden">
          <video playsInline muted ref={myVideo} autoPlay />
          <video playsInline ref={userVideo} autoPlay />
        </div>
      </div>
    </div>
  );
}
