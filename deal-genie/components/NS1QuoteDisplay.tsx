"use client";

import React, { useState } from "react";
import type { NS1SizingResult } from "@/lib/ns1-engine";

interface NS1QuoteDisplayProps {
  result: NS1SizingResult;
}

export function NS1QuoteDisplay({ result }: NS1QuoteDisplayProps) {
  const [activeTab, setActiveTab] = useState<"quote" | "parts" | "practices" | "tutorial" | "reference">("quote");

  return (
    <div className="w-full max-w-6xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => setActiveTab("quote")}
          className={`px-6 py-3 font-medium text-sm transition-colors ${
            activeTab === "quote"
              ? "border-b-2 border-blue-600 text-blue-600 bg-white"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          Quote Summary
        </button>
        <button
          onClick={() => setActiveTab("parts")}
          className={`px-6 py-3 font-medium text-sm transition-colors ${
            activeTab === "parts"
              ? "border-b-2 border-blue-600 text-blue-600 bg-white"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          Part Numbers
        </button>
        <button
          onClick={() => setActiveTab("practices")}
          className={`px-6 py-3 font-medium text-sm transition-colors ${
            activeTab === "practices"
              ? "border-b-2 border-blue-600 text-blue-600 bg-white"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          Best Practices
        </button>
        <button
          onClick={() => setActiveTab("tutorial")}
          className={`px-6 py-3 font-medium text-sm transition-colors ${
            activeTab === "tutorial"
              ? "border-b-2 border-blue-600 text-blue-600 bg-white"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          Tutorial
        </button>
        <button
          onClick={() => setActiveTab("reference")}
          className={`px-6 py-3 font-medium text-sm transition-colors ${
            activeTab === "reference"
              ? "border-b-2 border-blue-600 text-blue-600 bg-white"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          Quick Reference
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === "quote" && <QuoteSummaryTab result={result} />}
        {activeTab === "parts" && <PartNumbersTab result={result} />}
        {activeTab === "practices" && <BestPracticesTab result={result} />}
        {activeTab === "tutorial" && <TutorialTab result={result} />}
        {activeTab === "reference" && <QuickReferenceTab result={result} />}
      </div>
    </div>
  );
}

function QuoteSummaryTab({ result }: { result: NS1SizingResult }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">NS1 Quote Summary</h2>
        <p className="text-gray-600">{result.rationale}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Ballpark Monthly (MRR)</div>
          <div className="text-3xl font-bold text-blue-600">
            ${result.ballparkMRR.toLocaleString()}
          </div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Ballpark Annual</div>
          <div className="text-3xl font-bold text-green-600">
            ${result.ballparkAnnual.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-3">Configuration Details</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-600">Query Volume:</span>
            <span className="ml-2 font-medium">{result.effectiveMQ.toLocaleString()} MQ/month</span>
          </div>
          {result.billableRecords > 0 && (
            <div>
              <span className="text-gray-600">Billable Records:</span>
              <span className="ml-2 font-medium">{result.billableRecords.toLocaleString()}</span>
            </div>
          )}
          {result.filterChains > 0 && (
            <div>
              <span className="text-gray-600">Filter Chains:</span>
              <span className="ml-2 font-medium">{result.filterChains}</span>
            </div>
          )}
          {result.monitors > 0 && (
            <div>
              <span className="text-gray-600">Monitors:</span>
              <span className="ml-2 font-medium">{result.monitors}</span>
            </div>
          )}
          {result.rumPacks && (
            <div>
              <span className="text-gray-600">RUM Packs:</span>
              <span className="ml-2 font-medium">{result.rumPacks}</span>
            </div>
          )}
          {result.chinaMQ && (
            <div>
              <span className="text-gray-600">China Queries:</span>
              <span className="ml-2 font-medium">{result.chinaMQ} MQ/month</span>
            </div>
          )}
          {result.dnsInsights && (
            <div>
              <span className="text-gray-600">DNS Insights:</span>
              <span className="ml-2 font-medium text-green-600">Enabled</span>
            </div>
          )}
        </div>
      </div>

      {result.flags.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-900 mb-2">Important Notes</h3>
          <ul className="space-y-1 text-sm text-yellow-900">
            {result.flags.map((flag, idx) => (
              <li key={idx} className="flex items-start">
                <span className="mr-2">•</span>
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PartNumbersTab({ result }: { result: NS1SizingResult }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Part Numbers for CPQ</h2>
        <p className="text-gray-600 mb-4">
          Copy these part numbers and quantities into SAP CPQ to complete your quote.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Part Number</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {result.partNumbers.map((part, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">
                  <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{part.partNumber}</code>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">{part.description}</td>
                <td className="px-4 py-3 text-sm text-right font-medium">{part.quantity.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{part.unit}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{part.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Next Steps</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-900">
          <li>Paste part numbers and quantities into SAP CPQ</li>
          <li>Apply discounts per IBM pricing guidelines</li>
          <li>Get approval through the standard CPQ workflow</li>
        </ol>
      </div>
    </div>
  );
}

function BestPracticesTab({ result }: { result: NS1SizingResult }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">NS1 Quoting Best Practices</h2>
        <p className="text-gray-600">Follow these guidelines to gather accurate information.</p>
      </div>

      {result.bestPractices.map((practice, idx) => (
        <div key={idx} className="border border-gray-200 rounded-lg p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{practice.category}</h3>
          <div className="bg-gray-50 p-3 rounded mb-3">
            <p className="text-sm font-medium text-gray-700">Key Question:</p>
            <p className="text-sm text-gray-900 italic">"{practice.question}"</p>
          </div>
          <p className="text-sm text-gray-600 mb-3">{practice.why}</p>
          <ul className="space-y-1">
            {practice.tips.map((tip, tipIdx) => (
              <li key={tipIdx} className="text-sm text-gray-600 flex items-start">
                <span className="mr-2">✓</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TutorialTab({ result }: { result: NS1SizingResult }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Guided NS1 Quoting Tutorial</h2>
        <p className="text-gray-600">Step-by-step guide from discovery to CPQ entry.</p>
      </div>

      {result.tutorialSteps.map((step, idx) => (
        <div key={idx} className="border-l-4 border-blue-500 bg-white shadow rounded-r-lg p-5">
          <div className="flex items-start">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
              {step.step}
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-sm text-gray-600 mb-3">{step.description}</p>
              <div className="bg-blue-50 p-3 mb-3">
                <p className="text-sm font-medium text-blue-900">Action: {step.action}</p>
              </div>
              {step.example && (
                <div className="bg-green-50 p-3 mb-3">
                  <p className="text-sm text-green-800 italic">{step.example}</p>
                </div>
              )}
              {step.commonMistakes && (
                <div className="bg-red-50 p-3">
                  <p className="text-sm font-medium text-red-900 mb-1">Avoid:</p>
                  <ul className="space-y-1">
                    {step.commonMistakes.map((mistake, mIdx) => (
                      <li key={mIdx} className="text-sm text-red-800">• {mistake}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function QuickReferenceTab({ result }: { result: NS1SizingResult }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">NS1 Quick Reference</h2>
        <p className="text-gray-600">Essential information at your fingertips.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {result.quickReference.map((ref, idx) => (
          <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{ref.topic}</h3>
            <ul className="space-y-2">
              {ref.keyPoints.map((point, pIdx) => (
                <li key={pIdx} className="text-sm text-gray-700 flex items-start">
                  <span className="mr-2">→</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
