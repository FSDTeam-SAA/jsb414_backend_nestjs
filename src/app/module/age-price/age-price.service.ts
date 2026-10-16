import { Injectable } from '@nestjs/common';
import { CreateAgePriceDto } from './dto/create-age-price.dto';
import { UpdateAgePriceDto } from './dto/update-age-price.dto';

@Injectable()
export class AgePriceService {
  create(createAgePriceDto: CreateAgePriceDto) {
    return 'This action adds a new agePrice';
  }

  findAll() {
    return `This action returns all agePrice`;
  }

  findOne(id: number) {
    return `This action returns a #${id} agePrice`;
  }

  update(id: number, updateAgePriceDto: UpdateAgePriceDto) {
    return `This action updates a #${id} agePrice`;
  }

  remove(id: number) {
    return `This action removes a #${id} agePrice`;
  }
}
