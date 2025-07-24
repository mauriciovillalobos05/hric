import ChatWindow from "./components/chatWindow.jsx";

export default function MessagesDock({ openChats = [], onCloseChat }) {
  return (
    <>
      {openChats.map((chat, i) => (
        <ChatWindow
          key={chat.sender}
          chat={chat}
          index={i}
          onClose={() => onCloseChat(chat.sender)}
        />
      ))}
    </>
  );
}