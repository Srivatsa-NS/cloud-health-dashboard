from flask import Blueprint, jsonify
from config import boto_client

bp = Blueprint("security", __name__)

# Human-readable descriptions per well-known port
_PORT_DESCRIPTIONS = {
    22:   ("SSH — Remote login port",
           "This rule allows anyone on the internet to attempt to log in to your server using SSH. "
           "SSH is the most common way admins access servers remotely, but leaving it open to the whole internet means attackers can try to guess your password or exploit vulnerabilities. "
           "Restrict this to your own IP address only."),
    3389: ("RDP — Windows Remote Desktop",
           "This rule lets anyone on the internet try to remotely take control of your Windows machine. "
           "Remote Desktop is a common target for hackers who try to break in and install ransomware. "
           "Restrict this to your office or home IP address."),
    3306: ("MySQL — Database port",
           "Your MySQL database is directly accessible from the internet. "
           "Databases should never be exposed publicly — they contain your application's data and are a prime target for theft or manipulation. "
           "Limit access to only your application servers."),
    1433: ("MSSQL — Microsoft SQL Server database port",
           "Your Microsoft SQL Server database is reachable from anywhere on the internet. "
           "This makes it possible for anyone to attempt to steal or destroy your data. "
           "Restrict access to only the servers that need to connect to it."),
    5432: ("PostgreSQL — Database port",
           "Your PostgreSQL database is exposed to the entire internet. "
           "Databases contain sensitive business data and should only be accessible from within your private network. "
           "Remove this rule and allow only your application servers."),
    27017:("MongoDB — Database port",
           "Your MongoDB database is open to the internet. "
           "Publicly exposed MongoDB databases have been repeatedly targeted by attackers who delete all data and demand a ransom. "
           "Block all public access immediately."),
    6379: ("Redis — Cache/data store port",
           "Redis is accessible from the internet without any built-in authentication by default. "
           "Attackers can read, modify, or delete all cached data and in some configurations execute commands on your server. "
           "Restrict to internal access only."),
    443:  ("HTTPS — Secure web traffic",
           "Port 443 is the standard port for secure websites (HTTPS). "
           "While it is normal for web servers to accept HTTPS from anywhere, make sure your application is properly secured and up to date."),
    80:   ("HTTP — Web traffic",
           "Port 80 is the standard port for unencrypted web traffic. "
           "Allowing this publicly is normal for web servers, but consider redirecting all traffic to HTTPS (port 443) for better security."),
    8080: ("HTTP alternate port (often used for admin panels or test servers)",
           "Port 8080 is commonly used for development servers, admin dashboards, or proxy services. "
           "If this is an admin panel, exposing it publicly is dangerous — anyone could try to log in. "
           "Consider restricting access or moving to a private network."),
    21:   ("FTP — File transfer",
           "FTP is an old and insecure file transfer protocol that sends data including passwords in plain text. "
           "Anyone monitoring network traffic can steal your credentials. "
           "Use SFTP (over SSH port 22) instead, and only allow your own IP."),
    25:   ("SMTP — Email sending",
           "Leaving the email port open to the internet can allow spammers to use your server to send bulk emails, "
           "which can get your server blacklisted. Restrict this unless you are intentionally running a mail server."),
    0:    ("All traffic open",
           "This rule allows all types of traffic from any port to reach your server from the entire internet. "
           "This is extremely dangerous and means there are essentially no network restrictions protecting your server. "
           "You should delete this rule immediately and only allow specific ports that your application needs."),
}

_DEFAULT_RISKY = (
    "Open port accessible from the internet",
    "This port is reachable by anyone on the internet. "
    "Depending on what service is running on it, this could allow attackers to probe for vulnerabilities, "
    "brute-force passwords, or exploit software bugs. "
    "Consider restricting this to known IP addresses unless public access is intentional.",
)


def _port_info(port, protocol):
    label, description = _PORT_DESCRIPTIONS.get(port, _DEFAULT_RISKY)
    return label, description


@bp.route("/api/security")
def get_security_groups():
    client = boto_client("ec2")
    response = client.describe_security_groups()

    result = []
    for sg in response["SecurityGroups"]:
        risky_rules = []
        for rule in sg.get("IpPermissions", []):
            for ip_range in rule.get("IpRanges", []):
                if ip_range.get("CidrIp") == "0.0.0.0/0":
                    from_port = rule.get("FromPort", 0)
                    protocol = rule.get("IpProtocol", "tcp")
                    is_critical = from_port in [22, 3389, 1433, 3306, 5432, 27017, 6379, 21, 0]
                    label, description = _port_info(from_port, protocol)
                    risky_rules.append({
                        "port": from_port,
                        "protocol": protocol,
                        "cidr": "0.0.0.0/0",
                        "risk": "critical" if is_critical else "warning",
                        "label": label,
                        "description": description,
                    })
        result.append({
            "group_id": sg["GroupId"],
            "name": sg["GroupName"],
            "description": sg["Description"],
            "risky_rules": risky_rules,
        })

    return jsonify(result)
