import React from "react";

const Footer = () => (

<footer className="border-t bg-white"> <div className="max-w-7xl mx-auto px-6 py-6 text-sm text-gray-600 flex flex-col md:flex-row items-center justify-between gap-3"> <span>© {new Date().getFullYear()} HRIC</span> <div className="flex gap-4"> <button className="hover:text-gray-900">Terms</button> <button className="hover:text-gray-900">Privacy</button> <button className="hover:text-gray-900">Contact</button> </div> </div> </footer> );
export default Footer;