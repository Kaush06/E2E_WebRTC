import React, { useEffect, useCallback, useState } from "react";
import ReactPlayer from "react-player";
import peer from "../service/peer";
import { useSocket } from "../context/SocketProvider";
import "../App.css";
const RoomPage = () => {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  const [chat, setChat] = useState("");
  const [messages, setMessages] = useState([]);

  const handleUserJoined = useCallback(({ email, id }) => {
    // console.log(`Email ${email} joined room with id ${id}`);
    setRemoteSocketId(id);
  }, []);

  const handleCallUser = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    const offer = await peer.getOffer();
    socket.emit("user:call", { to: remoteSocketId, offer });
    setMyStream(stream);
  }, [remoteSocketId, socket]);

  const sendChat = useCallback(
    async () => {
    // console.log("Sending Chat", chat);

    const newMessage = {
      id: messages.length + 1,
      sender: "user",
      text: chat,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages([...messages, newMessage]);
    socket.emit("incoming:chat", { to: remoteSocketId, chat });
    setChat("");
  }, [remoteSocketId, socket, chat,setMessages]);

  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      setRemoteSocketId(from);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setMyStream(stream);
      console.log(`Incoming Call`, from, offer);
      const ans = await peer.getAnswer(offer);
      socket.emit("call:accepted", { to: from, ans });
    },
    [socket]
  );

  const sendStreams = useCallback(() => {
    for (const track of myStream.getTracks()) {
      peer.peer.addTrack(track, myStream);
    }
  }, [myStream]);

  const handleCallAccepted = useCallback(
    ({ from, ans }) => {
      peer.setLocalDescription(ans);
      // console.log("Call Accepted!");
      sendStreams();
    },
    [sendStreams]
  );

  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      const ans = await peer.getAnswer(offer);
      socket.emit("peer:nego:done", { to: from, ans });
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    await peer.setLocalDescription(ans);
  }, []);
  const handleAfterUserJoined = useCallback(
    (data) => {
      // console.log("After Join");
      // console.log("data", data);
      // console.log("data.socketId", data.socketId);
      setRemoteSocketId(data.socketId);
    },
    [setRemoteSocketId]
  );

  const handleIncomingChat = useCallback(
    ({ msg }) => {
      // console.log("Chat Received", msg);

      const newMessage = {
        id: messages.length + 1,
        sender: "remote",
        text: msg,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages([...messages, newMessage]);
    },
    [messages, setMessages]
  );

  useEffect(() => {
    peer.peer.addEventListener("track", async (ev) => {
      const remoteStream = ev.streams;
      console.log("GOT TRACKS!!");
      setRemoteStream(remoteStream[0]);
    });
  }, []);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);

    socket.on("chat:received", handleIncomingChat);
    socket.on("after:join", handleAfterUserJoined);

    return () => {
      // console.log("CLEANUP");
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);

      socket.off("chat:received", handleIncomingChat);
      socket.off("after:join", handleAfterUserJoined);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
    handleIncomingChat,
  ]);

  return (
    <div>
      <h1>Room Page</h1>
      <h4>{remoteSocketId ? "Connected" : "No one in room"}</h4>
      {myStream && <button onClick={sendStreams}>Send Stream</button>}
      {remoteSocketId && <button onClick={handleCallUser}>CALL</button>}
      <br />
      <div
      className="chat-box"
        style={{
          height: "500px",
          overflowY: "scroll",
          border: "1px solid #ddd",
          padding: "5px",
        }}
      >
        <h2>Chat-Box</h2>
        {messages.map((msg) => (
          <div className="chat-msg"
            key={msg.id}
            style={{
              textAlign: msg.sender === "user" ? "right" : "left",
              margin: "5px",
            }}
          >
            <strong>{msg.sender}:</strong> {msg.text}{" "}
            <small>({msg.timestamp})</small>
          </div>
        ))}
      </div>
      <input value={chat} onChange={(e) => setChat(e.target.value)}></input>

      <button onClick={sendChat}>Send Message</button>

      {myStream && (
        <>
          <h1>My Stream</h1>
          <ReactPlayer
            playing
            muted
            height="100px"
            width="200px"
            url={myStream}
          />
        </>
      )}
      {remoteStream && (
        <>
          <h1>Remote Stream</h1>
          <ReactPlayer
            playing
            muted
            height="100px"
            width="200px"
            url={remoteStream}
          />
        </>
      )}
    </div>
  );
};

export default RoomPage;
