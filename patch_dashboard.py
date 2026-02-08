
import os

file_path = r"d:\E\VSCode programs\SEM 4\SGP - systemB\Main\EndpointRiskAnalyzer\frontend\src\pages\Dashboard.jsx"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Part 1: Risk Breakdown (around lines 301-314)
# We look for the start of the risk score block
start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if "{scan.scan_data?.risk_assessment" in line and "risk_score !== undefined" in lines[i+1]:
        start_idx = i
        # Find the closing block
        depth = 0
        for j in range(i, len(lines)):
            depth += lines[j].count('{')
            depth -= lines[j].count('}')
            if depth == 0 and j > i:
                end_idx = j
                break
        break

if start_idx != -1 and end_idx != -1:
    new_content = [
        '                                      {/* Detailed Risk Breakdown */}\n',
        '                                      {scan.scan_data?.risk_assessment?.risk_score !== undefined && (\n',
        '                                        <div className="mt-4 pt-3 border-t border-slate-200">\n',
        '                                          <div className="mb-4">\n',
        '                                            <p className="text-[10px] font-bold text-slate-800 uppercase tracking-wider mb-2">Risk Factor Breakdown</p>\n',
        '                                            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 shadow-inner">\n',
        '                                              {scan.scan_data?.risk_assessment?.breakdown?.length > 0 ? (\n',
        '                                                scan.scan_data.risk_assessment.breakdown.map((item, bIdx) => (\n',
        '                                                  <div key={bIdx} className="flex justify-between items-center text-[10px] border-b border-slate-50 pb-1 last:border-0 last:pb-0">\n',
        '                                                    <span className="text-slate-600 font-medium">{item[0]}</span>\n',
        '                                                    <span className="text-red-600 font-bold px-1.5 py-0.5 bg-red-50 rounded">+{item[1]}</span>\n',
        '                                                  </div>\n',
        '                                                ))\n',
        '                                              ) : (\n',
        '                                                <p className="text-[10px] text-gray-500 italic text-center py-1">No specific risk components provided.</p>\n',
        '                                              )}\n',
        '                                            </div>\n',
        '                                          </div>\n',
        '\n',
        '                                          {/* Risky Port Detection */}\n',
        '                                          {openPorts.some(p => [21, 23, 25, 135, 139, 445, 3389].includes(parseInt(p)) || [21, 23, 25, 135, 139, 445, 3389].includes(p)) && (\n',
        '                                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg shadow-sm">\n',
        '                                              <p className="text-[11px] font-black text-red-700 mb-2 flex items-center gap-1.5">\n',
        '                                                <span className="text-sm">⚠️</span> CRITICAL PORT EXPOSURE\n',
        '                                              </p>\n',
        '                                              <div className="flex flex-wrap gap-1.5">\n',
        '                                                {openPorts.filter(p => [21, 23, 25, 135, 139, 445, 3389].includes(parseInt(p)) || [21, 23, 25, 135, 139, 445, 3389].includes(p)).map((p, pIdx) => (\n',
        '                                                  <span key={pIdx} className="px-2 py-1 bg-red-600 text-white text-[10px] font-black rounded border border-red-700 shadow-sm">\n',
        '                                                    PORT {p}\n',
        '                                                  </span>\n',
        '                                                ))}\n',
        '                                              </div>\n',
        '                                              <p className="mt-2 text-[9px] text-red-600 font-medium leading-tight">These ports are known to be used by common exploits and should be closed unless absolutely necessary.</p>\n',
        '                                            </div>\n',
        '                                          )}\n',
        '\n',
        '                                          <div className="flex justify-between items-center bg-slate-100 p-2.5 rounded-lg border border-slate-200 shadow-sm">\n',
        '                                            <div className="flex flex-col">\n',
        '                                              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-tight">System Risk</p>\n',
        '                                              <p className="text-xs font-bold text-slate-900">{riskLevel}</p>\n',
        '                                            </div>\n',
        '                                            <div className="text-right">\n',
        '                                              <span className={`text-lg font-black px-3 py-1 rounded-md shadow-md inline-block ${getRiskColor(riskLevel)}`}>\n',
        '                                                {scan.scan_data.risk_assessment.risk_score}/100\n',
        '                                              </span>\n',
        '                                            </div>\n',
        '                                          </div>\n',
        '                                        </div>\n',
        '                                      )}\n'
    ]
    lines[start_idx:end_idx+1] = new_content

# Part 2: Endpoint limiting button styling and cleanup (around lines 327+)
# We find the View More button
view_more_start = -1
view_more_end = -1
for i, line in enumerate(lines):
    if 'onClick={() => window.location.href = "/endpoints"}' in line:
        # Find the outer div
        curr = i
        while curr > 0 and 'endpoints.length > 5' not in lines[curr]:
            curr -= 1
        view_more_start = curr
        
        # Find the end of this block
        depth = 0
        for j in range(curr, len(lines)):
            depth += lines[j].count('{')
            depth -= lines[j].count('}')
            if depth == 0 and j > curr:
                view_more_end = j
                break
        break

if view_more_start != -1 and view_more_end != -1:
    new_btn = [
        '            {endpoints.length > 5 && (\n',
        '              <div className="p-4 border-t border-slate-200 flex justify-center bg-slate-50/50 rounded-b-xl">\n',
        '                <button\n',
        '                  onClick={() => window.location.href = "/endpoints"}\n',
        '                  className="group inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 hover:text-slate-900 hover:bg-white rounded-full border border-slate-200 shadow-sm transition-all duration-300 active:scale-95"\n',
        '                >\n',
        '                  View All Endpoints\n',
        '                  <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n',
        '                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />\n',
        '                  </svg>\n',
        '                </button>\n',
        '              </div>\n',
        '            )}\n'
    ]
    lines[view_more_start:view_more_end+1] = new_btn

# Part 3: Posture Summary Section (Clean Up)
# Just to be sure there's no invalid character, we rewrite the title
for i, line in enumerate(lines):
    if "Latest Posture Summary" in line:
        lines[i] = '          <h2 className="text-lg font-semibold mb-2 text-slate-900">Latest Posture Summary</h2>\n'
        break

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Patch applied successfully")
