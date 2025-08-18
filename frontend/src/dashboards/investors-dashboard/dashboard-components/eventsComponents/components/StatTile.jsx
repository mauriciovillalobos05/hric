import React from "react";

const StatTile = ({ label, value, icon: Icon, gradient = "from-blue-500 to-blue-600" }) => (

<div className={`bg-gradient-to-br ${gradient} text-white p-6 rounded-xl`}> <div className="flex items-center justify-between"> <div> <p className="opacity-90">{label}</p> <p className="text-2xl font-bold">{value}</p> </div> {Icon ? <Icon className="w-8 h-8 opacity-80" /> : null} </div> </div> );
export default StatTile;