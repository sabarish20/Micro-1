resource "aws_vpc" "vpc" {
    cidr_block = var.cidr_block
    enable_dns_hostnames = var.enable_dns_hostnames
    enable_dns_support = var.enable_dns_support
    tags = {
      Name = "${var.projname}-${local.envname}"
    }
}

resource "aws_subnet" "pub_sub" {
    vpc_id = aws_vpc.vpc.id
    availability_zone = var.availability_zone
    cidr_block = cidrsubnet(aws_vpc.vpc.cidr_block, 8, 1)
    tags = {
      Name = "${var.projname}-PublicSubnet"
    }
}

resource "aws_internet_gateway" "igw" {
    vpc_id = aws_vpc.vpc.id
    tags = {
      Name = "${var.projname}-IGW"
    }
}

resource "aws_route_table" "pub_rt" {
    vpc_id = aws_vpc.vpc.id
    tags = {
      Name = "${var.projname}-RouteTable"
    }
}

resource "aws_route" "pub_route" {
    route_table_id = aws_route_table.pub_rt.id
    destination_cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
}

resource "aws_route_table_association" "pub_rta" {
    route_table_id = aws_route_table.pub_rt.id
    gateway_id = aws_internet_gateway.igw.id
}

resource "aws_security_group" "ingress_sg" {
    vpc_id = aws_vpc.vpc.id
    tags = {
      Name = "Ingress-SG"
    }
}

resource "aws_vpc_security_group_ingress_rule" "name" {
    security_group_id = aws_security_group.ingress_sg.id
    cidr_ipv4 = "0.0.0.0/0"
    from_port = "22"
    
}