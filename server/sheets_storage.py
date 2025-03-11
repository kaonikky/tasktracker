from typing import List, Dict, Optional
import gspread
from datetime import datetime
from cachetools import TTLCache
import json
import os
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SheetsStorage:
    def __init__(self):
        # Кэш для хранения данных с TTL 5 минут (300 секунд)
        self.cache = TTLCache(maxsize=100, ttl=300)

        try:
            # Загружаем сервисный аккаунт
            service_account_info = json.loads(os.getenv('GOOGLE_SERVICE_ACCOUNT_KEY', '{}'))
            if not service_account_info:
                raise ValueError("GOOGLE_SERVICE_ACCOUNT_KEY не настроен")

            self.client = gspread.service_account_from_dict(service_account_info)
            logger.info("Successfully authenticated with service account")

            # ID таблицы
            self.spreadsheet_id = os.getenv('VITE_GOOGLE_SHEETS_ID')
            if not self.spreadsheet_id:
                raise ValueError("VITE_GOOGLE_SHEETS_ID не настроен")

            self.spreadsheet = self.client.open_by_key(self.spreadsheet_id)
            logger.info(f"Successfully opened spreadsheet: {self.spreadsheet.title}")

            # Проверяем существование листа contracts
            try:
                self.worksheet = self.spreadsheet.worksheet('contracts')
                logger.info("Found existing 'contracts' worksheet")
            except gspread.WorksheetNotFound:
                # Создаем лист, если он не существует
                self.worksheet = self.spreadsheet.add_worksheet('contracts', 1000, 8)
                logger.info("Created new 'contracts' worksheet")
                # Устанавливаем заголовки
                self.headers = [
                    'Название компании', 'ИНН', 'Директор', 'Адрес',
                    'Дата окончания', 'Комментарии', 'НД', 'ID'
                ]
                self.worksheet.append_row(self.headers)
                logger.info("Added headers to the worksheet")

        except Exception as e:
            logger.error(f"Error initializing SheetsStorage: {str(e)}")
            raise

    def _get_all_records(self) -> List[Dict]:
        """Получает все записи с кэшированием"""
        cache_key = 'all_records'
        if cache_key in self.cache:
            return self.cache[cache_key]

        try:
            records = self.worksheet.get_all_records()
            logger.info(f"Raw records from sheets: {records}")
            self.cache[cache_key] = records
            return records
        except Exception as e:
            logger.error(f"Error getting records: {str(e)}")
            return []

    def _clear_cache(self):
        """Очищает кэш"""
        self.cache.clear()

    def get_all_contracts(self) -> List[Dict]:
        """Получает все контракты"""
        try:
            records = self._get_all_records()
            logger.info(f"Processing {len(records)} records")

            contracts = []
            for record in records:
                try:
                    # Проверяем наличие всех необходимых полей
                    if not record.get('ID'):
                        logger.warning(f"Skipping record without ID: {record}")
                        continue

                    # Преобразуем дату
                    try:
                        end_date = record.get('Дата окончания', '')
                        if isinstance(end_date, str) and end_date:
                            # Пробуем разные форматы даты
                            date_formats = ['%d.%m.%Y', '%Y-%m-%d']
                            parsed_date = None
                            for date_format in date_formats:
                                try:
                                    parsed_date = datetime.strptime(end_date, date_format)
                                    break
                                except ValueError:
                                    continue
                            if parsed_date:
                                end_date = parsed_date.isoformat()
                            else:
                                logger.warning(f"Could not parse date: {end_date}")
                                end_date = datetime.now().isoformat()
                    except Exception as e:
                        logger.error(f"Date parsing error: {e}")
                        end_date = datetime.now().isoformat()

                    contract = {
                        'id': int(record['ID']),
                        'companyName': record.get('Название компании', ''),
                        'inn': record.get('ИНН', ''),
                        'director': record.get('Директор', ''),
                        'address': record.get('Адрес', ''),
                        'endDate': end_date,
                        'comments': record.get('Комментарии', ''),
                        'hasND': str(record.get('НД', '')).lower() == 'true',
                        'status': 'active',  # Добавляем статус по умолчанию
                        'history': [],  # Добавляем пустую историю
                        'createdAt': datetime.now().isoformat()  # Добавляем текущую дату создания
                    }
                    contracts.append(contract)
                except Exception as e:
                    logger.error(f"Error processing record: {e}, record: {record}")
                    continue

            logger.info(f"Successfully processed {len(contracts)} contracts")
            return contracts
        except Exception as e:
            logger.error(f"Error in get_all_contracts: {e}")
            raise

    def add_contract(self, contract: Dict) -> Dict:
        """Добавляет новый контракт"""
        try:
            # Генерируем уникальный ID
            all_records = self._get_all_records()
            existing_ids = [int(r.get('ID', 0)) for r in all_records if r.get('ID')]
            new_id = max(existing_ids, default=0) + 1

            # Преобразуем данные для записи
            row_data = [
                contract['companyName'],
                contract['inn'],
                contract['director'],
                contract['address'],
                contract['endDate'],
                contract['comments'],
                str(contract['hasND']).lower(),
                str(new_id)
            ]

            # Добавляем новую строку
            self.worksheet.append_row(row_data)
            self._clear_cache()
            logger.info(f"Added new contract with ID: {new_id}")

            # Возвращаем добавленный контракт с дополнительными полями
            contract['id'] = new_id
            contract['status'] = 'active'
            contract['history'] = []
            contract['createdAt'] = datetime.now().isoformat()
            return contract
        except Exception as e:
            logger.error(f"Error adding contract: {str(e)}")
            raise

    def update_contract(self, contract_id: int, contract: Dict) -> Optional[Dict]:
        """Обновляет существующий контракт"""
        try:
            records = self._get_all_records()

            # Находим строку для обновления
            row_number = None
            for i, record in enumerate(records, start=2):  # start=2 because of headers
                if str(record.get('ID')) == str(contract_id):
                    row_number = i
                    break

            if not row_number:
                logger.warning(f"Contract with ID {contract_id} not found")
                return None

            # Обновляем данные
            update_data = [
                contract.get('companyName', records[row_number-2]['Название компании']),
                contract.get('inn', records[row_number-2]['ИНН']),
                contract.get('director', records[row_number-2]['Директор']),
                contract.get('address', records[row_number-2]['Адрес']),
                contract.get('endDate', records[row_number-2]['Дата окончания']),
                contract.get('comments', records[row_number-2]['Комментарии']),
                str(contract.get('hasND', records[row_number-2]['НД'])).lower(),
                str(contract_id)
            ]

            # Обновляем строку
            cell_range = f'A{row_number}:H{row_number}'
            self.worksheet.update(cell_range, [update_data])
            self._clear_cache()
            logger.info(f"Updated contract with ID: {contract_id}")

            # Возвращаем обновленный контракт
            contract['id'] = contract_id
            return contract
        except Exception as e:
            logger.error(f"Error updating contract: {str(e)}")
            raise

    def get_contract(self, contract_id: int) -> Optional[Dict]:
        """Получает контракт по ID"""
        try:
            records = self._get_all_records()
            for record in records:
                if str(record.get('ID')) == str(contract_id):
                    return {
                        'id': record['ID'],
                        'companyName': record['Название компании'],
                        'inn': record['ИНН'],
                        'director': record['Директор'],
                        'address': record['Адрес'],
                        'endDate': record['Дата окончания'],
                        'comments': record['Комментарии'],
                        'hasND': record['НД'].lower() == 'true'
                    }
            logger.warning(f"Contract with ID {contract_id} not found")
            return None
        except Exception as e:
            logger.error(f"Error getting contract: {str(e)}")
            raise

# Создаем единственный экземпляр хранилища
storage = SheetsStorage()