import React from 'react';
import img1 from '../images/img1.jpg';
import img2 from '../images/img2.jpeg';

const contacts = [
    {
        name: "Ayaan Mansuri",
        role: "Security Analyst and Developer",
        email: "24dce069@charusat.edu.in",
        // phone: "+91 98765 43210",
        // img: "https://i.pravatar.cc/150?u=aarav",
        img: img1,
        github: "https://github.com",
        linkedin: "https://linkedin.com"
    },
    {
        name: "Harsh Joshi",
        role: "AI/ML Engineer",
        email: "24dce049@charusat.edu.in",
        // phone: "+91 87654 32109",
        // img: "https://i.pravatar.cc/150?u=ishita",
        github: "https://github.com",
        linkedin: "https://linkedin.com"
    },
    {
        name: "Manav Merja",
        role: "Full Stack Developer",
        email: "24dce074@charusat.edu.in",
        // phone: "+91 76543 21098",
        // img: "https://i.pravatar.cc/150?u=rohan",
        github: "https://github.com",
        linkedin: "https://linkedin.com"
    },
    {
        name: "Devanshu Khandvi",
        role: "Frontend Developer",
        email: "24dce057@charusat.edu.in",
        // phone: "+91 65432 10987",
        // img: "https://i.pravatar.cc/150?u=sanya",
        img: img2,
        github: "https://github.com",
        linkedin: "https://linkedin.com"
    }
];

export default function Contact() {
    return (
        <div className="p-6 bg-slate-100 dark:bg-slate-900 min-h-screen transition-colors duration-300">
            <div className="max-w-6xl mx-auto py-12">
                <div className="text-center mb-16">
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4">Contact Our Team</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium max-w-2xl mx-auto uppercase text-xs tracking-widest">
                        We are here to help you secure your endpoints and maintain a robust posture. Reach out to any of our lead experts.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {contacts.map((c, i) => (
                        <div key={i} className="group relative bg-white dark:bg-slate-800 p-8 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all duration-500 shadow-sm hover:shadow-2xl hover:-translate-y-2 overflow-hidden">
                            {/* Animated Background Pulse */}
                            <div className="absolute -top-12 -right-12 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:scale-[3] transition-all duration-700"></div>

                            <div className="relative z-10 flex flex-col items-center text-center">
                                <div className="w-24 h-24 mb-6 relative">
                                    {/* <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-20 group-hover:opacity-40 transition-opacity"></div> */}
                                    <div className="absolute inset-0 bg-indigo-500 rounded-full opacity-10 group-hover:opacity-40 transition-opacity"></div>
                                    <img
                                        src={c.img}
                                        alt={c.name}
                                        className="w-full h-full object-cover rounded-full border-4 border-white dark:border-slate-700 shadow-lg group-hover:border-indigo-500 transition-colors"
                                    />
                                </div>

                                <h2 className="text-lg font-black text-slate-900 dark:text-white mb-1 tracking-tight">{c.name}</h2>
                                <p className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest mb-4">{c.role}</p>

                                <div className="space-y-1 mb-6">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">{c.email}</p>
                                    {/* <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{c.phone}</p> */}
                                </div>

                                <div className="flex gap-4 mt-auto">
                                    <a href={c.github} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-900 transition-all">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                        </svg>
                                    </a>
                                    <a href={c.linkedin} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white transition-all">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.761 0 5-2.239 5-5v-14c0-2.761-2.239-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                                        </svg>
                                    </a>
                                </div>
                            </div>

                            {/* Border Color Shift Line */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
