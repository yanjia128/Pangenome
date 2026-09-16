import React from "react";
import { Card } from "flowbite-react";
import { HiMail, HiOfficeBuilding, HiUser } from "react-icons/hi";

interface ContactPerson {
  name: string;
  title: string;
  department: string;
  university: string;
  email: string;
  description: string;
  icon: React.ReactNode;
}

const contacts: ContactPerson[] = [
  {
    name: "Wei-Sheng Wu",
    title: "Professor",
    department: "Department of Electrical Engineering",
    university: "National Cheng Kung University",
    email: "wessonwu@mail.ncku.edu.tw",
    description: "For technical issues",
    icon: <HiUser className="w-5 h-5" />,
  },
  {
    name: "Wen-Chieh Tsai",
    title: "Professor",
    department: "Institute of Tropical Plant Sciences and Microbiology",
    university: "National Cheng Kung University",
    email: "tsaiwc@mail.ncku.edu.tw",
    description: "For design issues",
    icon: <HiUser className="w-5 h-5" />,
  },
];

export default function ContactPage() {
  return (
    <div id="content" className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
            Get in Touch
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            We're here to help. Contact our team for any questions or support.
          </p>
        </div>

        {/* Contact Cards Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {contacts.map((contact, index) => (
            <Card
              key={index}
              className="hover:shadow-2xl transition-shadow duration-300 border-0"
            >
              <div className="flex flex-col h-full">
                {/* Contact Header */}
                <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-2">
                        {contact.description}
                      </p>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {contact.name}
                      </h2>
                    </div>
                  </div>
                  <p className="text-base font-medium text-gray-700 dark:text-gray-300">
                    {contact.title}
                  </p>
                </div>

                {/* Contact Details */}
                <div className="space-y-4 flex-1">
                  {/* Department */}
                  <div className="flex items-start space-x-3">
                    <HiOfficeBuilding className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {contact.department}
                      </p>
                    </div>
                  </div>

                  {/* University */}
                  <div className="flex items-start space-x-3">
                    <HiOfficeBuilding className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {contact.university}
                      </p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-start space-x-3 pt-2">
                    <HiMail className="w-5 h-5 text-green-600 dark:text-green-400 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 break-all"
                      >
                        {contact.email}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Email Button */}
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <a
                    href={`mailto:${contact.email}`}
                    className="w-full inline-flex justify-center items-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200"
                  >
                    <HiMail className="w-5 h-5 mr-2" />
                    Send Email
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Additional Info Section */}
        <div className="mt-16 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            How to reach us
          </h3>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold text-lg text-gray-900 dark:text-white mb-3">
                Technical Support
              </h4>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                For any technical issues, bugs, or inquiries related to the technical implementation
                of the Pangenome project, please reach out to Dr. Wei-Sheng Wu.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-lg text-gray-900 dark:text-white mb-3">
                Design & Biology
              </h4>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                For questions about the project design, biological insights, or data interpretation,
                please contact Dr. Wen-Chieh Tsai.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
