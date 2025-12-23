#!/bin/bash
set -e

# Setup AWS prerequisites for deployment
# This script helps create ACM certificate and Route53 private hosted zone

AWS_REGION="us-east-1"
DOMAIN="mcdinternal.io"
WILDCARD_DOMAIN="*.mcdinternal.io"

echo "=========================================="
echo "AWS Prerequisites Setup"
echo "=========================================="

# Check for existing ACM certificates
echo ""
echo "Checking for existing ACM certificates..."
CERT_ARN=$(aws acm list-certificates --region ${AWS_REGION} \
    --query "CertificateSummaryList[?DomainName=='${WILDCARD_DOMAIN}'].CertificateArn | [0]" \
    --output text)

if [ "$CERT_ARN" != "None" ] && [ ! -z "$CERT_ARN" ]; then
    echo "✓ Found existing certificate: ${CERT_ARN}"
else
    echo ""
    echo "No certificate found for ${WILDCARD_DOMAIN}"
    echo ""
    echo "To create a certificate, you have two options:"
    echo ""
    echo "1. DNS Validation (recommended if you control the domain):"
    echo "   aws acm request-certificate \\"
    echo "     --region ${AWS_REGION} \\"
    echo "     --domain-name \"${WILDCARD_DOMAIN}\" \\"
    echo "     --validation-method DNS \\"
    echo "     --subject-alternative-names \"${DOMAIN}\""
    echo ""
    echo "2. Import an existing certificate:"
    echo "   aws acm import-certificate \\"
    echo "     --region ${AWS_REGION} \\"
    echo "     --certificate fileb://certificate.pem \\"
    echo "     --private-key fileb://private-key.pem \\"
    echo "     --certificate-chain fileb://certificate-chain.pem"
    echo ""
    read -p "Do you want to request a new certificate now? (yes/no): " -r
    if [[ $REPLY =~ ^[Yy] ]]; then
        echo "Requesting certificate..."
        CERT_ARN=$(aws acm request-certificate \
            --region ${AWS_REGION} \
            --domain-name "${WILDCARD_DOMAIN}" \
            --validation-method DNS \
            --subject-alternative-names "${DOMAIN}" \
            --query 'CertificateArn' \
            --output text)
        echo "Certificate requested: ${CERT_ARN}"
        echo ""
        echo "IMPORTANT: You must complete DNS validation!"
        echo "Get validation records with:"
        echo "  aws acm describe-certificate --certificate-arn ${CERT_ARN} --region ${AWS_REGION}"
    fi
fi

# Check for Route53 hosted zones
echo ""
echo "Checking for Route53 hosted zone..."
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
    --query "HostedZones[?Name=='${DOMAIN}.'].Id | [0]" \
    --output text | cut -d/ -f3)

if [ "$HOSTED_ZONE_ID" != "None" ] && [ ! -z "$HOSTED_ZONE_ID" ]; then
    echo "✓ Found existing hosted zone: ${HOSTED_ZONE_ID}"

    # Check if it's private
    IS_PRIVATE=$(aws route53 get-hosted-zone --id ${HOSTED_ZONE_ID} \
        --query 'HostedZone.Config.PrivateZone' \
        --output text)

    if [ "$IS_PRIVATE" == "True" ]; then
        echo "  Zone is private (correct for Tailscale deployment)"
    else
        echo "  WARNING: Zone is public. For Tailscale-only access, you may want a private zone."
    fi
else
    echo ""
    echo "No hosted zone found for ${DOMAIN}"
    echo ""
    echo "Available VPCs for private hosted zone:"
    aws ec2 describe-vpcs --query 'Vpcs[*].[VpcId,CidrBlock,Tags[?Key==`Name`].Value|[0]]' --output table
    echo ""
    read -p "Enter VPC ID for private hosted zone (or press Enter to skip): " VPC_ID

    if [ ! -z "$VPC_ID" ]; then
        echo "Creating private hosted zone..."
        HOSTED_ZONE_ID=$(aws route53 create-hosted-zone \
            --name ${DOMAIN} \
            --vpc VPCRegion=${AWS_REGION},VPCId=${VPC_ID} \
            --caller-reference "$(date +%s)" \
            --hosted-zone-config Comment="Private zone for Tailscale internal services",PrivateZone=true \
            --query 'HostedZone.Id' \
            --output text | cut -d/ -f3)
        echo "✓ Created hosted zone: ${HOSTED_ZONE_ID}"
    fi
fi

# Summary
echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
if [ ! -z "$CERT_ARN" ] && [ "$CERT_ARN" != "None" ]; then
    echo "ACM Certificate ARN:"
    echo "  ${CERT_ARN}"
fi
if [ ! -z "$HOSTED_ZONE_ID" ] && [ "$HOSTED_ZONE_ID" != "None" ]; then
    echo "Route53 Hosted Zone ID:"
    echo "  ${HOSTED_ZONE_ID}"
fi

echo ""
echo "Next steps:"
echo "1. Update infrastructure/env/dev-us-security/terraform.tfvars with these values:"
if [ ! -z "$CERT_ARN" ] && [ "$CERT_ARN" != "None" ]; then
    echo "   alb_certificate_arn = \"${CERT_ARN}\""
fi
if [ ! -z "$HOSTED_ZONE_ID" ] && [ "$HOSTED_ZONE_ID" != "None" ]; then
    echo "   hosted_zone_id = \"${HOSTED_ZONE_ID}\""
fi
echo "   enable_dns_cdn = true"
echo ""
echo "2. Update secrets in terraform.tfvars (anthropic_api_key, google_client_id, etc.)"
echo ""
echo "3. Run deployment:"
echo "   ./scripts/deploy.sh dev"
