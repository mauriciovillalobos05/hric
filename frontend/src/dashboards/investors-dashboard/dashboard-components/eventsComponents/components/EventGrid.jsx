import React from "react";
import EventCard from "./EventCard";

const EventGrid = ({ events = [] }) => (

<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"> {events.map((ev) => ( <EventCard key={ev.id} event={ev} /> ))} </div> );
export default EventGrid;

