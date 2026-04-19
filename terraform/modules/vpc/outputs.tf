output "subnet_id" {
    value = aws_subnet.pub_sub.id
}

output "vpc_id" {
    value = aws_vpc.vpc.id
}

output "vpc_arn" {
    value = aws_vpc.vpc.arn
}

output "subnet_arn" {
    value = aws_subnet.pub_sub.arn
}

