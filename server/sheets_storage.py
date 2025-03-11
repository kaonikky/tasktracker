```python
from typing import List, Dict, Optional
import gspread
from gspread.models import Worksheet
from datetime import datetime
from cachetools import TTLCache
import json
import os

class SheetsStorage:
    def __init__(self):
        # Кэш для хранения данных с TTL 5 минут (300 секунд)
        self.cache = TTLCache(maxsize=100, ttl=300)
        
        # Загружаем сервисный аккаунт
        service_account_info = json.loads(os.getenv('GOOGLE_SERVICE_ACCOUNT_KEY'))
        self.client = gspread.service_account_from_dict(service_account_info)
        
        # ID таблицы
        self.spreadsheet_id = os.getenv('VITE_GOOGLE_SHEETS_ID')
        if not self.spreadsheet_id:
            raise ValueError("GOOGLE_SHEETS_ID not configured")
            
        self.spreadsheet = self.client.open_by_key(self.spreadsheet_id)
        self.worksheet = self.spreadsheet.worksheet('contracts')
        
        # Заголовки колонок
        self.headers = [
            'Название компании', 'ИНН', 'Директор', 'Адрес',
            'Дата окончания', 'Комментарии', 'НД', 'ID'
        ]

    def _get_all_records(self) -> List[Dict]:
        """Получает все записи с кэшированием"""
        cache_key = 'all_records'
        if cache_key in self.cache:
            return self.cache[cache_key]

        records = self.worksheet.get_all_records()
        self.cache[cache_key] = records
        return records

    def _clear_cache(self):
        """Очищает кэш"""
        self.cache.clear()

    def get_all_contracts(self) -> List[Dict]:
        """Получает все контракты"""
        records = self._get_all_records()
        return [{
            'id': record.get('ID', ''),
            'companyName': record.get('Название компании', ''),
            'inn': record.get('ИНН', ''),
            'director': record.get('Директор', ''),
            'address': record.get('Адрес', ''),
            'endDate': record.get('Дата окончания', ''),
            'comments': record.get('Комментарии', ''),
            'hasND': record.get('НД', '').lower() == 'true'
        } for record in records]

    def add_contract(self, contract: Dict) -> Dict:
        """Добавляет новый контракт"""
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

        # Возвращаем добавленный контракт
        contract['id'] = new_id
        return contract

    def update_contract(self, contract_id: int, contract: Dict) -> Optional[Dict]:
        """Обновляет существующий контракт"""
        records = self._get_all_records()
        
        # Находим строку для обновления
        row_number = None
        for i, record in enumerate(records, start=2):  # start=2 because of headers
            if str(record.get('ID')) == str(contract_id):
                row_number = i
                break

        if not row_number:
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

        # Возвращаем обновленный контракт
        contract['id'] = contract_id
        return contract

    def get_contract(self, contract_id: int) -> Optional[Dict]:
        """Получает контракт по ID"""
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
        return None

# Создаем единственный экземпляр хранилища
storage = SheetsStorage()
```
