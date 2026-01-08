import subprocess
# import json
from day1 import run_day1_scan, evaluate_basic_risk_flags
from day3 import extract_features


def detect_java_runtime():

    try:

    
        command=["java","--version"]

        output=subprocess.check_output(command,text=True)

        first_line=output.splitlines()[0]
        # first_line=output.splitlines()[0].split()
        

        # return{"program":first_line[0],"present": True, "version": first_line[1]}
        return{"present": True, "version_raw": first_line}
    
    except FileNotFoundError:
        return{"present": False, "version_raw": None}
    except Exception as e:
        return {
            "present": "Unknown",
            "error": str(e)
        }

# print(detect_java_runtime())


def detect_python_runtime():
    try:


        output=subprocess.check_output(["python","--version"],text=True)

        return {
            "present": True,
            "version_raw": output.strip()
        }

    except FileNotFoundError:
        return {
            "present": False,
            "version_raw": None
        }
    except Exception as e:
        return {
            "present": "Unknown",
            "error": str(e)
        }
        
# print(detect_python_runtime())

def collect_runtimes():
    return {
        "java": detect_java_runtime(),
        "python": detect_python_runtime()
    }


def run_day2_scan():
    scan = run_day1_scan()
    scan["runtimes"] = collect_runtimes()
    scan["risk_flags"] = evaluate_basic_risk_flags(scan)

    scan["features"],scan["risk_assessment"] = extract_features(scan)
    
    # explanation = explain_with_llm(scan, llm_client)
    # scan.update(explanation)
    
    return scan








# if __name__ == "__main__":
#     scan_result = run_day2_scan()
#     print(json.dumps(scan_result, indent=2))
#     # print("\n\n\n", json.dumps(extract_features(scan_result), indent=2))    #ML values
#     print("\n\n\n", json.dumps(scan_result, indent=2))    #ML values
